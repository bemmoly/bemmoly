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

const ORG_ADMINS: Cells = [true, false, false, false, false];

/**
 * The People rows of the roles matrix. Reading the directory and asking for one's own time
 * off need none: the person record is open to everyone signed in (ADR 0050). Employment facts
 * are the kernel's `workspace.people.manage`.
 */
const CAPABILITIES: ReadonlyArray<readonly [string, string, string, Cells]> = [
  [
    'people.settings.manage',
    'Manage People settings',
    'Levels, leave policies, journey templates',
    ORG_ADMINS,
  ],
  [
    'people.journeys.manage',
    'Run journeys',
    'Start onboarding and offboarding, hand tasks on',
    ORG_ADMINS,
  ],
  ['people.leave.manage', 'Manage time off', 'See everyone’s time off and balances', ORG_ADMINS],
  ['people.profiles.edit', 'Edit profiles', 'Company fields on anyone’s profile', ORG_ADMINS],
];

export const PEOPLE_CAPABILITIES: readonly CapabilityDefinition[] = CAPABILITIES.map(
  ([name, label, description, cells]) => ({
    name: name as CapabilityDefinition['name'],
    label,
    description,
    group: 'People',
    defaults: defaults(cells),
  }),
);
