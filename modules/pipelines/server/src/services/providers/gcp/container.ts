import { z } from 'zod';
import { ValidationError } from '@bemmoly/shared';
import type { ReleaseArtifact, ResolvedDeploySettings } from '../contract.ts';

/*
 * What a release asks of the container it runs in, as Cloud Run's template says it. The
 * release carries the application's deploy settings (port, CPU, memory, health check, whether
 * it is public) in its resolved config, so a revision runs the way the pipeline file said at
 * the time it was built, whatever the file says now.
 */

const settingsSchema = z
  .object({
    port: z.union([z.number().int(), z.string()]).optional(),
    resources: z
      .object({ cpu: z.union([z.number(), z.string()]), memory: z.string() })
      .partial()
      .optional(),
    healthcheck: z
      .object({ path: z.string().default('/healthz'), timeoutSeconds: z.number().default(5) })
      .optional(),
    public: z.boolean().optional(),
  })
  .catch({});

export type DeploySettings = z.infer<typeof settingsSchema>;

export const deploySettingsOf = (release: ReleaseArtifact): DeploySettings =>
  settingsSchema.parse(release.resolvedConfig['deploy'] ?? {});

/** The image by digest: Cloud Run then runs exactly the bytes the release names. */
export function imageOf(release: ReleaseArtifact): string {
  const digest = release.imageDigests['linux/amd64'] ?? Object.values(release.imageDigests)[0];
  if (!release.imageRepository || !digest) {
    throw new ValidationError(`Release ${release.version} has no image to deploy`);
  }
  if (release.imageRepository.startsWith('bemmoly-local/')) {
    throw new ValidationError(
      `Release ${release.version} was built into the runner's own Docker, which Cloud Run cannot reach. Set a registry on the Google Cloud connection, then build again`,
    );
  }
  return `${release.imageRepository}@${digest}`;
}

export const portOf = (port: DeploySettings['port']) => {
  const value = typeof port === 'string' ? Number(port) : port;
  return value && Number.isInteger(value) && value > 0 && value < 65536 ? value : null;
};

/**
 * The first container of a revision: the image plus the settings resolved for this
 * environment. `env`, when given, is the whole environment; values set by hand on an earlier
 * revision do not carry over. The startup probe waits for `ready` (or `path`), and the
 * liveness probe restarts an instance whose `path` stops answering.
 */
export function containerOf(
  release: ReleaseArtifact,
  settings: ResolvedDeploySettings,
  base: Record<string, unknown> = {},
  env?: ReadonlyArray<Record<string, unknown>>,
  mounts?: ReadonlyArray<Record<string, unknown>>,
): Record<string, unknown> {
  const port = settings.port;
  const limits = {
    ...(settings.resources.cpu !== null ? { cpu: settings.resources.cpu } : {}),
    ...(settings.resources.memory !== null ? { memory: settings.resources.memory } : {}),
  };
  const baseResources = (base['resources'] as Record<string, unknown> | undefined) ?? {};
  const { path, ready, timeoutSeconds } = settings.healthcheck;
  // Cloud Run wants the timeout no longer than the period, and both at most 240s.
  const timing = {
    timeoutSeconds: Math.min(240, timeoutSeconds),
    periodSeconds: Math.min(240, Math.max(10, timeoutSeconds)),
  };
  const startup = ready ?? path;
  return {
    ...base,
    image: imageOf(release),
    ...(env ? { env: [...env] } : {}),
    ...(mounts && mounts.length > 0 ? { volumeMounts: [...mounts] } : {}),
    ...(port ? { ports: [{ containerPort: port }] } : {}),
    ...(Object.keys(limits).length > 0
      ? {
          resources: {
            ...baseResources,
            limits: { ...((baseResources['limits'] as object | undefined) ?? {}), ...limits },
          },
        }
      : {}),
    ...(startup ? { startupProbe: { httpGet: { path: startup }, ...timing } } : {}),
    ...(path ? { livenessProbe: { httpGet: { path }, ...timing } } : {}),
  };
}

/** The revision's scaling, as Cloud Run's template says it. */
export function scalingOf(settings: ResolvedDeploySettings) {
  const { min, max, concurrency } = settings.scaling;
  return {
    scaling: { minInstanceCount: min, ...(max !== null ? { maxInstanceCount: max } : {}) },
    ...(concurrency !== null ? { maxInstanceRequestConcurrency: concurrency } : {}),
  };
}
