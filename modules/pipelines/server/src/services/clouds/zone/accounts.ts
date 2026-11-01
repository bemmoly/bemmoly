import { z } from 'zod';
import type { Layout } from '../../../../../shared/clouds.ts';
import type { EnvironmentClass } from '../../../../../shared/common.ts';
import { shortHash } from '../hash.ts';
import { accountIdOf, prefixOf } from '../naming.ts';

/*
 * Which accounts a layout declares (journeys proposal, "Projects and clusters"):
 *   starter                 the control project doubles as the platform project and holds the
 *                           registry; one project for non-production, one for production
 *   per-environment         Standard: control, a CI project and one project per environment
 *   per-domain-environment  Enterprise: control, CI and one per domain and environment, each
 *                           domain in its own folder
 *   per-group-environment   control, CI and one per group and environment
 */

export const zoneConfigSchema = z.looseObject({
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

export type ZoneConfig = z.infer<typeof zoneConfigSchema>;

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

export interface ZoneEnvironment {
  id: string;
  key: string;
  class: EnvironmentClass;
}

export interface DesiredAccount {
  externalId: string;
  name: string;
  folder: string | null;
  purpose: 'workload' | 'ci' | 'control';
  /** The environment it serves; for an account several share, the first of them. */
  environment: ZoneEnvironment | null;
  /** Every environment that deploys here, when more than one does (Starter's non-production). */
  environments?: ZoneEnvironment[];
  domain: { id: string; key: string; name: string } | null;
  /** Made by someone else, such as bootstrap.sh's control project: checked, never changed. */
  adopted?: boolean;
}

export interface ZoneAccounts {
  control: DesiredAccount;
  /** Where the shared registry and the build identity live. */
  home: DesiredAccount;
  workloads: DesiredAccount[];
  /** Control first, then CI when the layout has one, then workloads. */
  all: DesiredAccount[];
}

const envOf = (environment: ZoneInput['environments'][number]): ZoneEnvironment => ({
  id: environment.id,
  key: environment.key,
  class: environment.class,
});

function starterWorkloads(input: ZoneInput, id: (parts: string[]) => string): DesiredAccount[] {
  const tiers = [
    { key: 'nonprod', name: 'Non-production', match: (cls: EnvironmentClass) => cls !== 'prod' },
    { key: 'prod', name: 'Production', match: (cls: EnvironmentClass) => cls === 'prod' },
  ];
  return tiers.flatMap((tier) => {
    const environments = input.environments.filter((env) => tier.match(env.class)).map(envOf);
    const [first] = environments;
    if (!first) return [];
    return [
      {
        externalId: id([tier.key]),
        name: tier.name,
        folder: null,
        purpose: 'workload' as const,
        environment: first,
        environments,
        domain: null,
      },
    ];
  });
}

function splitWorkloads(input: ZoneInput, id: (parts: string[]) => string): DesiredAccount[] {
  const workloads: DesiredAccount[] = [];
  const add = (
    parts: string[],
    name: string,
    folder: string | null,
    environment: ZoneInput['environments'][number],
    domain: DesiredAccount['domain'],
  ) =>
    workloads.push({
      externalId: id(parts),
      name,
      folder,
      purpose: 'workload',
      environment: envOf(environment),
      domain,
    });
  for (const environment of input.environments) {
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
  return workloads;
}

export function declareAccounts(input: ZoneInput, config: ZoneConfig): ZoneAccounts {
  const prefix = prefixOf(input.connection.name, config.prefix);
  const suffix = shortHash(input.connection.id);
  const id = (parts: string[]) => accountIdOf(prefix, parts, suffix);
  const starter = input.connection.layout === 'starter';
  const named = config.controlAccount ?? config.controlProject;
  const control: DesiredAccount = {
    externalId: named ?? id(['control']),
    name: starter ? 'Bemmoly platform' : 'Bemmoly control',
    folder: null,
    purpose: 'control',
    environment: null,
    domain: null,
    ...(named ? { adopted: true } : {}),
  };
  const workloads = starter ? starterWorkloads(input, id) : splitWorkloads(input, id);
  if (starter) return { control, home: control, workloads, all: [control, ...workloads] };
  const ci: DesiredAccount = {
    externalId: id(['ci']),
    name: 'Bemmoly CI',
    folder: null,
    purpose: 'ci',
    environment: null,
    domain: null,
  };
  return { control, home: ci, workloads, all: [control, ci, ...workloads] };
}
