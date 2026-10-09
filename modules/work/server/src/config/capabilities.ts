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
 * The Work rows of the roles matrix: the "Projects" group of the People mock,
 * plus the project-level rows of the Board Settings mock's Permissions tab that
 * are not already one of them. Org locks are rows in the matrix an org admin
 * sets; no Work row is locked in the mock's default state.
 */
const CAPABILITIES: ReadonlyArray<readonly [string, string, string | null, Cells]> = [
  ['work.project.create', 'Create projects', null, ADMINS],
  ['work.project.configure', 'Configure project', 'Board, workflow, fields, members', ADMINS],
  ['work.issue.view', 'View issues', null, EVERYONE],
  ['work.issue.edit', 'Create and edit issues', null, CONTRIBUTORS],
  ['work.issue.delete', 'Delete issues', 'Soft delete, 30-day recovery', ADMINS],
  [
    'work.issue.transition',
    'Move issues between columns',
    'Status transitions follow the workflow',
    COLLEAGUES,
  ],
  ['work.sprint.manage', 'Start and complete sprints', null, COLLEAGUES],
  ['work.board.configure', 'Configure board', 'Columns, lanes, cards, settings', ADMINS],
  ['work.board.method', 'Change method', 'Switch Scrum and Kanban', ADMINS],
  ['work.board.wip', 'Edit WIP limits', 'Without opening settings', ADMINS],
];

export const WORK_CAPABILITIES: readonly CapabilityDefinition[] = CAPABILITIES.map(
  ([name, label, description, cells]) => ({
    name: name as CapabilityDefinition['name'],
    label,
    ...(description ? { description } : {}),
    group: 'Projects',
    defaults: defaults(cells),
  }),
);
