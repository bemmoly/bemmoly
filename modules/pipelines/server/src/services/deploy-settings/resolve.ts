import type { DeployRuntime, EnvironmentClass } from '../../../../shared/common.ts';
import {
  DEPLOY_SETTING_FIELDS,
  deploySettingsSchema,
  flattenDeploySettings,
  nestDeploySettings,
  type DeploySettingEntry,
  type DeploySettingField,
  type DeploySettingSource,
  type DeploySettings,
  type FlatDeploySettings,
} from '../../../../shared/deploy-settings.ts';
import type { DeployTarget, ReleaseArtifact } from '../providers/contract.ts';
import type { ResolvedDeploySettings } from '../providers/deploy-settings-contract.ts';

/*
 * One environment's deploy settings from their layers (shared/deploy-settings.ts): Pipelines,
 * then the file's entry for the environment, then the file's `deploy`, then the runtime's
 * default. Pure, so the API, the deploy and the providers resolve the same way.
 */

export interface SettingsLayers {
  pipelines: DeploySettings;
  fileEnvironment: FlatDeploySettings;
  file: FlatDeploySettings;
}

export interface ResolveInput {
  layers: SettingsLayers;
  runtime: DeployRuntime;
  environmentClass: EnvironmentClass;
  environmentKey: string;
  /** What the file says beyond the settings: the health check's timeout, and public. */
  extras?: { timeoutSeconds?: number | undefined; public?: boolean | undefined };
}

export interface Resolution {
  settings: ResolvedDeploySettings;
  entries: DeploySettingEntry[];
  disruptionBudget: boolean;
  problem: string | null;
}

/** GKE keeps one replica above the budget, and ten at most unless min asks for more. */
const GKE_MAX = 10;
const GKE_CPU_TARGET = 70;

export const onCluster = (runtime: DeployRuntime) => runtime !== 'cloud-run';

/** What a runtime does when nothing sets a value. */
function defaultsFor(runtime: DeployRuntime, environmentClass: EnvironmentClass) {
  if (!onCluster(runtime)) {
    return { 'scaling.min': 0, secretsAs: 'env' } satisfies FlatDeploySettings;
  }
  return {
    'scaling.min': environmentClass === 'prod' ? 2 : 1,
    'scaling.cpuTarget': GKE_CPU_TARGET,
    secretsAs: 'env',
  } satisfies FlatDeploySettings;
}

const ONLY_ON: Partial<Record<DeploySettingField, 'cloud-run' | 'cluster'>> = {
  'scaling.concurrency': 'cloud-run',
  'scaling.cpuTarget': 'cluster',
};

export const appliesOn = (field: DeploySettingField, runtime: DeployRuntime) => {
  const only = ONLY_ON[field];
  if (!only) return true;
  return only === 'cluster' ? onCluster(runtime) : !onCluster(runtime);
};

/**
 * A layer read from a file, where any value may be malformed: each field is kept only when
 * it would pass the API's own check, and a port written as "8080" counts as 8080.
 */
export function fileLayerOf(raw: unknown): FlatDeploySettings {
  if (typeof raw !== 'object' || raw === null) return {};
  const flat = flattenDeploySettings(raw as DeploySettings);
  const kept: FlatDeploySettings = {};
  for (const [field, value] of Object.entries(flat) as Array<[DeploySettingField, unknown]>) {
    const candidate = field === 'port' && typeof value === 'string' ? Number(value) : value;
    const parsed = deploySettingsSchema.safeParse(nestDeploySettings({ [field]: candidate }));
    if (parsed.success && (typeof candidate === 'number' || typeof candidate === 'string')) {
      kept[field] = candidate;
    }
  }
  return kept;
}

const num = (value: unknown) => (typeof value === 'number' ? value : null);
const str = (value: unknown) =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;

export function resolveDeploySettings(input: ResolveInput): Resolution {
  const { runtime } = input;
  const pipelines = flattenDeploySettings(input.layers.pipelines);
  const defaults: FlatDeploySettings = defaultsFor(runtime, input.environmentClass);
  const order: Array<[DeploySettingSource, FlatDeploySettings]> = [
    ['pipelines', pipelines],
    ['file-environment', input.layers.fileEnvironment],
    ['file', input.layers.file],
    ['default', defaults],
  ];
  const entries = DEPLOY_SETTING_FIELDS.map((field): DeploySettingEntry => {
    const applies = appliesOn(field, runtime);
    const found = order.find(([, layer]) => layer[field] !== undefined);
    return {
      field,
      value: applies && found ? (found[1][field] ?? null) : null,
      source: applies && found ? found[0] : 'default',
      applies,
    };
  });
  const value = (field: DeploySettingField) => entries.find((e) => e.field === field)?.value;
  const min = num(value('scaling.min')) ?? 0;
  const chosenMax = num(value('scaling.max'));
  const max = onCluster(runtime) ? (chosenMax ?? Math.max(min, GKE_MAX)) : chosenMax;
  if (onCluster(runtime) && chosenMax === null) {
    const entry = entries.find((e) => e.field === 'scaling.max');
    if (entry) entry.value = max;
  }
  const problem =
    max !== null && min > max
      ? `scaling.min (${min}) is above scaling.max (${max}) in ${input.environmentKey}. Lower min or raise max`
      : null;
  const disruptionBudget = onCluster(runtime) && min >= 2;
  return {
    settings: {
      scaling: {
        min,
        max,
        concurrency: num(value('scaling.concurrency')),
        cpuTarget: num(value('scaling.cpuTarget')),
      },
      resources: { cpu: str(value('resources.cpu')), memory: str(value('resources.memory')) },
      port: num(value('port')),
      healthcheck: {
        path: str(value('healthcheck.path')),
        ready: str(value('healthcheck.ready')),
        timeoutSeconds: input.extras?.timeoutSeconds ?? 5,
      },
      secretsAs: value('secretsAs') === 'files' ? 'files' : 'env',
      maxUnavailable: disruptionBudget ? 1 : null,
      public: input.extras?.public ?? false,
    },
    entries,
    disruptionBudget,
    problem,
  };
}

/** The file's layers from a release's resolved config: `deploy` and its environment entry. */
export function fileLayersOf(
  resolvedConfig: Readonly<Record<string, unknown>>,
  environment: string,
) {
  const deploy = resolvedConfig['deploy'];
  const record =
    typeof deploy === 'object' && deploy !== null ? (deploy as Record<string, unknown>) : {};
  const environments = record['environments'];
  const own =
    typeof environments === 'object' && environments !== null
      ? (environments as Record<string, unknown>)[environment]
      : undefined;
  const health = record['healthcheck'] as { timeoutSeconds?: unknown } | undefined;
  return {
    file: fileLayerOf(record),
    fileEnvironment: fileLayerOf(own),
    extras: {
      timeoutSeconds:
        typeof health?.timeoutSeconds === 'number' ? health.timeoutSeconds : undefined,
      public: typeof record['public'] === 'boolean' ? record['public'] : undefined,
    },
  };
}

/** What a revision runs with: what the deploy resolved, or the file's alone (tests, export). */
export function settingsOf(release: ReleaseArtifact, target: DeployTarget): ResolvedDeploySettings {
  return settingsFor(release, {
    environmentKey: target.environment.key,
    environmentClass: target.environment.class,
    runtime: target.placement?.runtime ?? 'cloud-run',
  });
}

export function settingsFor(
  release: ReleaseArtifact,
  where: { environmentKey: string; environmentClass: EnvironmentClass; runtime: DeployRuntime },
): ResolvedDeploySettings {
  if (release.settings) return release.settings;
  const { file, fileEnvironment, extras } = fileLayersOf(
    release.resolvedConfig,
    where.environmentKey,
  );
  return resolveDeploySettings({
    layers: { pipelines: {}, file, fileEnvironment },
    runtime: where.runtime,
    environmentClass: where.environmentClass,
    environmentKey: where.environmentKey,
    extras,
  }).settings;
}
