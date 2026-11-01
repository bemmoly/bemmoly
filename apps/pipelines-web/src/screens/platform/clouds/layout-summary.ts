import type { EnvironmentClass, Layout } from '@bemmoly/module-pipelines/shared';

/*
 * What a layout would create for the environments there are now, before the connection
 * exists: how many projects and what they are for. The plan on the next step names each one
 * exactly; this is what the chooser shows beside each layout.
 */

export type ManagedLayout = 'starter' | 'per-environment' | 'per-domain-environment';

export interface LayoutSummary {
  /** Projects in the layout, the control project bootstrap.sh made among them. */
  projects: number;
  /** Of those, the ones Pipelines creates. */
  created: number;
  /** What the projects are, the shared ones first. */
  parts: Array<{ kind: 'platform' | 'control' | 'ci' | 'tier' | 'environment'; name: string }>;
}

export function summarize(
  layout: ManagedLayout | Layout,
  environments: ReadonlyArray<{ name: string; class: EnvironmentClass }>,
  domains: number,
): LayoutSummary {
  if (layout === 'starter') {
    const tiers = [
      ...(environments.some((env) => env.class !== 'prod') ? ['nonprod'] : []),
      ...(environments.some((env) => env.class === 'prod') ? ['prod'] : []),
    ];
    return {
      projects: 1 + tiers.length,
      created: tiers.length,
      parts: [
        { kind: 'platform', name: 'platform' },
        ...tiers.map((tier) => ({ kind: 'tier' as const, name: tier })),
      ],
    };
  }
  const perEnvironment = layout === 'per-domain-environment' ? Math.max(domains, 0) : 1;
  const created = 1 + environments.length * perEnvironment;
  return {
    projects: created + 1,
    created,
    parts: [
      { kind: 'control', name: 'control' },
      { kind: 'ci', name: 'ci' },
      ...environments.map((env) => ({ kind: 'environment' as const, name: env.name })),
    ],
  };
}
