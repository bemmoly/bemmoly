import type { Layout } from '@bemmoly/module-pipelines/shared';

/** A layout's name and the trade it makes, as the chooser and the connection card say them. */
export const LAYOUT_LABEL = {
  starter: 'pipelines.clouds.layout.starter',
  'per-environment': 'pipelines.clouds.layout.perEnvironment',
  'per-domain-environment': 'pipelines.clouds.layout.perDomainEnvironment',
  'per-group-environment': 'pipelines.clouds.layout.perGroupEnvironment',
} as const satisfies Record<Layout, string>;

export const LAYOUT_HINT = {
  starter: 'pipelines.clouds.layoutHint.starter',
  'per-environment': 'pipelines.clouds.layoutHint.perEnvironment',
  'per-domain-environment': 'pipelines.clouds.layoutHint.perDomainEnvironment',
  'per-group-environment': 'pipelines.clouds.layoutHint.perGroupEnvironment',
} as const satisfies Record<Layout, string>;
