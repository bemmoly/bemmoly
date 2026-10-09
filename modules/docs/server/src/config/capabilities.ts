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

const ADMINS: Cells = [true, true, false, false, false];
const CONTRIBUTORS: Cells = [true, true, true, false, true];
const COLLEAGUES: Cells = [true, true, true, false, false];
const EVERYONE: Cells = [true, true, true, true, true];

/**
 * The Docs rows of the roles matrix: the "Docs" group of the People mock, plus
 * the rows the services need that the mock folds into them (viewing pages,
 * configuring a space, deleting a page). No Docs row is locked by default.
 */
const CAPABILITIES: ReadonlyArray<readonly [string, string, string | null, Cells]> = [
  ['docs.space.create', 'Create spaces', null, ADMINS],
  ['docs.space.configure', 'Configure space', 'Name, members, templates', ADMINS],
  ['docs.page.view', 'View pages', null, EVERYONE],
  ['docs.page.edit', 'Edit pages', null, CONTRIBUTORS],
  ['docs.page.delete', 'Delete pages', 'Soft delete, 30-day recovery', COLLEAGUES],
  ['docs.page.publish', 'Publish and restrict pages', null, COLLEAGUES],
  ['docs.space.export', 'Export space', null, ADMINS],
];

export const DOCS_CAPABILITIES: readonly CapabilityDefinition[] = CAPABILITIES.map(
  ([name, label, description, cells]) => ({
    name: name as CapabilityDefinition['name'],
    label,
    ...(description ? { description } : {}),
    group: 'Docs',
    defaults: defaults(cells),
  }),
);
