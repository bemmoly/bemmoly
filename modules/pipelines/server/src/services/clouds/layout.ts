import { z } from 'zod';
import type { Layout } from '../../../../shared/clouds.ts';
import type { EnvironmentClass } from '../../../../shared/common.ts';
import type { DesiredResource } from '../providers/contract.ts';
import { keyOf } from './order.ts';
import type { Feature, SpecOf } from '../providers/specs.ts';
import { shortHash, specHash } from './hash.ts';
import { accountIdOf, prefixOf } from './naming.ts';

/*
 * The landing zone as declared (architecture §14): from the connection's layout, the
 * environments and the catalog, the neutral accounts and resources that should exist. One
 * account per environment, per domain and environment (the default above 100 engineers) or
 * per group and environment, plus a CI account holding the shared registry and the control
 * account the bootstrap made. Pure: the same input always declares the same zone.
 */

const zoneConfigSchema = z.looseObject({
  prefix: z.string().optional(),
  controlAccount: z.string().optional(),
  controlProject: z.string().optional(),
  folderName: z.string().default('Bemmoly'),
  region: z.string().default('us-central1'),
  /** Monthly budgets per environment class; a class with none gets no budget. */
  monthlyBudgets: z
    .partialRecord(z.enum(['dev', 'staging', 'prod']), z.number().positive())
    .default({}),
  currency: z.string().length(3).default('USD'),
});

export interface ZoneInput {
  connection: {
    id: string;
    name: string;
    layout: Layout;
    config: Readonly<Record<string, unknown>>;
  };
  environments: ReadonlyArray<{ id: string; key: string; name: string; class: EnvironmentClass }>;
  domains: ReadonlyArray<{ id: string; key: string; name: string }>;
  groups: ReadonlyArray<{ id: string; key: string; name: string; domainId: string }>;
}

export interface DesiredAccount {
  externalId: string;
  name: string;
  folder: string | null;
  purpose: 'workload' | 'ci' | 'control';
  environment: { id: string; key: string; class: EnvironmentClass } | null;
  domain: { id: string; key: string; name: string } | null;
}

export interface DesiredZone {
  layout: Layout;
  folderName: string;
  accounts: DesiredAccount[];
  resources: DesiredResource[];
  /** Over the whole declaration: what the person previews is what Apply applies. */
  hash: string;
}

const WORKLOAD_FEATURES: Feature[] = [
  'containers',
  'registry',
  'secrets',
  'metrics',
  'logging',
  'identity',
  'network',
];
const CI_FEATURES: Feature[] = ['registry', 'builds', 'logging', 'metrics', 'identity'];
const REGISTRY = 'apps';

/** The resource and its key, so dependencies can name it. */
function declare<Kind extends DesiredResource['kind']>(
  out: DesiredResource[],
  kind: Kind,
  name: string,
  account: string,
  spec: SpecOf<Kind>,
  dependsOn: string[] = [],
): string {
  const resource = { kind, name, account, spec, dependsOn };
  out.push(resource);
  return keyOf(resource);
}

export function resourceHash(resource: DesiredResource): string {
  return specHash({ spec: resource.spec, dependsOn: [...resource.dependsOn].sort() });
}

export function buildZone(input: ZoneInput): DesiredZone {
  const config = zoneConfigSchema.parse(input.connection.config);
  const prefix = prefixOf(input.connection.name, config.prefix);
  const suffix = shortHash(input.connection.id);
  const environments = [...input.environments];
  const workloads: DesiredAccount[] = [];
  const add = (
    parts: string[],
    name: string,
    folder: string | null,
    environment: ZoneInput['environments'][number],
    domain: DesiredAccount['domain'],
  ) =>
    workloads.push({
      externalId: accountIdOf(prefix, parts, suffix),
      name,
      folder,
      purpose: 'workload',
      environment: { id: environment.id, key: environment.key, class: environment.class },
      domain,
    });
  for (const environment of environments) {
    if (input.connection.layout === 'per-environment') {
      add([environment.key], environment.name, null, environment, null);
    } else if (input.connection.layout === 'per-domain-environment') {
      for (const domain of input.domains) {
        add(
          [domain.key, environment.key],
          `${domain.name} · ${environment.name}`,
          domain.name,
          environment,
          domain,
        );
      }
    } else {
      for (const group of input.groups) {
        const domain = input.domains.find((candidate) => candidate.id === group.domainId) ?? null;
        add(
          [domain?.key ?? '', group.key, environment.key],
          `${group.name} · ${environment.name}`,
          domain?.name ?? null,
          environment,
          domain,
        );
      }
    }
  }
  const ci: DesiredAccount = {
    externalId: accountIdOf(prefix, ['ci'], suffix),
    name: 'Bemmoly CI',
    folder: null,
    purpose: 'ci',
    environment: null,
    domain: null,
  };
  const control: DesiredAccount = {
    externalId:
      config.controlAccount ?? config.controlProject ?? accountIdOf(prefix, ['control'], suffix),
    name: 'Bemmoly control',
    folder: null,
    purpose: 'control',
    environment: null,
    domain: null,
  };

  const resources: DesiredResource[] = [];
  declare(resources, 'account', control.externalId, control.externalId, {
    displayName: control.name,
    folder: null,
    labels: { purpose: 'control' },
  });
  const ciAccount = declare(resources, 'account', ci.externalId, ci.externalId, {
    displayName: ci.name,
    folder: null,
    labels: { purpose: 'ci' },
  });
  const ciApis = declare(
    resources,
    'service_api',
    'apis',
    ci.externalId,
    { features: CI_FEATURES },
    [ciAccount],
  );
  const builder = declare(
    resources,
    'runtime_identity',
    'builder',
    ci.externalId,
    { name: 'builder', purpose: 'build' },
    [ciApis],
  );
  const registry = declare(
    resources,
    'registry_access',
    REGISTRY,
    ci.externalId,
    {
      registryAccount: ci.externalId,
      repository: REGISTRY,
      region: config.region,
      access: 'push',
      identity: 'builder',
    },
    [builder],
  );
  declare(resources, 'logging', 'logs', ci.externalId, { retentionDays: 30 }, [ciApis]);

  for (const account of workloads) {
    const id = account.externalId;
    const environment = account.environment;
    if (!environment) continue;
    const labels: Record<string, string> = {
      environment: environment.key,
      class: environment.class,
    };
    if (account.domain) labels['domain'] = account.domain.key;
    const root = declare(resources, 'account', id, id, {
      displayName: account.name,
      folder: account.folder,
      labels,
    });
    const apis = declare(resources, 'service_api', 'apis', id, { features: WORKLOAD_FEATURES }, [
      root,
    ]);
    declare(resources, 'network', 'bemmoly', id, { name: 'bemmoly', subnets: 'auto' }, [apis]);
    declare(resources, 'deployer_identity', 'deployer', id, { name: 'deployer' }, [apis]);
    const runtime = declare(
      resources,
      'runtime_identity',
      'runtime',
      id,
      { name: 'runtime', purpose: 'runtime' },
      [apis],
    );
    declare(
      resources,
      'registry_access',
      REGISTRY,
      id,
      {
        registryAccount: ci.externalId,
        repository: REGISTRY,
        region: config.region,
        access: 'pull',
        identity: 'runtime',
      },
      [apis, registry],
    );
    declare(resources, 'secret_store', 'secrets', id, { readers: ['runtime'] }, [runtime]);
    declare(
      resources,
      'logging',
      'logs',
      id,
      { retentionDays: environment.class === 'prod' ? 90 : 30 },
      [apis],
    );
    const budget = config.monthlyBudgets[environment.class];
    if (budget)
      declare(
        resources,
        'budget',
        'monthly',
        id,
        { monthly: budget, currency: config.currency, alerts: [0.5, 0.9, 1] },
        [root],
      );
  }

  const accounts = [control, ci, ...workloads];
  return {
    layout: input.connection.layout,
    folderName: config.folderName,
    accounts,
    resources,
    hash: specHash({
      layout: input.connection.layout,
      folder: config.folderName,
      accounts,
      resources,
    }),
  };
}
