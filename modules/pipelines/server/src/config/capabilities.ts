import type { CapabilityDefinition, SystemRole } from '@bemmoly/core';

type Cells = readonly [boolean, boolean, boolean, boolean, boolean];

const defaults = ([orgAdmin, projectAdmin, member, viewer, contractor]: Cells) =>
  ({
    org_admin: orgAdmin,
    project_admin: projectAdmin,
    member,
    viewer,
    contractor,
  }) satisfies Readonly<Record<SystemRole, boolean>>;

const ADMINS: Cells = [true, false, false, false, false];
const LEADS: Cells = [true, true, false, false, false];
const ENGINEERS: Cells = [true, true, true, false, false];
const BUILDERS: Cells = [true, true, true, false, true];
const EVERYONE: Cells = [true, true, true, true, true];

/**
 * The product-level gate: what a person may do in Pipelines at all, after the module grant
 * says they may use it. Inside, role bindings at a scope and policies on environments decide
 * (the access service), so these rows stay coarse and never name a scope.
 */
const CAPABILITIES: ReadonlyArray<readonly [string, string, string | null, Cells]> = [
  ['pipelines.view', 'View pipelines', 'Applications, runs, logs and releases', EVERYONE],
  ['pipelines.run', 'Run pipelines', 'Start, re-run and cancel runs', BUILDERS],
  ['pipelines.deploy', 'Deploy', 'Deploy and request promotions; policy decides Prod', ENGINEERS],
  ['pipelines.approve', 'Approve promotions', 'Policy names who may approve each one', ENGINEERS],
  [
    'pipelines.manage',
    'Manage applications',
    'Catalog, variables, role bindings and policies',
    LEADS,
  ],
  [
    'pipelines.platform.admin',
    'Administer the platform',
    'Clouds, environments, runners and templates',
    ADMINS,
  ],
  ['pipelines.audit', 'Audit', 'Read every decision and export change records', ADMINS],
];

export const PIPELINES_CAPABILITIES: readonly CapabilityDefinition[] = CAPABILITIES.map(
  ([name, label, description, cells]) => ({
    name: name as CapabilityDefinition['name'],
    label,
    ...(description ? { description } : {}),
    group: 'Pipelines',
    defaults: defaults(cells),
  }),
);
