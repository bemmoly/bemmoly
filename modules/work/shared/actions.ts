import { z } from 'zod';

/*
 * The actions a role may be granted or denied in Work: one capability each, so the kernel's
 * roles matrix stores the cells and a project role overrides the org role as for any
 * capability. The defaults per system role are the cells each action had before it was split
 * out of a broader one, and a changeset copies every stored cell of the broader one, so
 * nothing anyone could do changes until an admin edits the matrix.
 */

/** Cells for Org admin, Project admin, Member, Viewer and Contractor, in that order. */
export type ActionCells = readonly [boolean, boolean, boolean, boolean, boolean];

const ADMINS: ActionCells = [true, true, false, false, false];
const CONTRIBUTORS: ActionCells = [true, true, true, false, true];
const COLLEAGUES: ActionCells = [true, true, true, false, false];
const EVERYONE: ActionCells = [true, true, true, true, true];

export const WORK_ACTION_AREAS = [
  'Projects',
  'Issues',
  'Sprints',
  'Boards',
  'Workflows and automation',
] as const;

export type WorkActionArea = (typeof WORK_ACTION_AREAS)[number];

export interface WorkActionDefinition {
  name: `work.${string}`;
  label: string;
  description: string | null;
  area: WorkActionArea;
  defaults: ActionCells;
}

export const WORK_ACTIONS = [
  {
    name: 'work.project.create',
    label: 'Create projects',
    description: null,
    area: 'Projects',
    defaults: ADMINS,
  },
  {
    name: 'work.project.configure',
    label: 'Configure project',
    description: 'Fields, issue types, members, versions',
    area: 'Projects',
    defaults: ADMINS,
  },
  {
    name: 'work.issue.view',
    label: 'View issues',
    description: null,
    area: 'Issues',
    defaults: EVERYONE,
  },
  {
    name: 'work.issue.edit',
    label: 'Create and edit issues',
    description: null,
    area: 'Issues',
    defaults: CONTRIBUTORS,
  },
  {
    name: 'work.issue.delete',
    label: 'Delete issues',
    description: 'Cards and comments; soft delete, 30-day recovery',
    area: 'Issues',
    defaults: ADMINS,
  },
  {
    name: 'work.issue.transition',
    label: 'Move issues between columns',
    description: 'Status transitions follow the workflow',
    area: 'Issues',
    defaults: COLLEAGUES,
  },
  {
    name: 'work.epic.manage',
    label: 'Manage epics',
    description: 'Create, edit and delete epics',
    area: 'Issues',
    defaults: CONTRIBUTORS,
  },
  {
    name: 'work.sprint.create',
    label: 'Create sprints',
    description: null,
    area: 'Sprints',
    defaults: COLLEAGUES,
  },
  {
    name: 'work.sprint.start',
    label: 'Start sprints',
    description: null,
    area: 'Sprints',
    defaults: COLLEAGUES,
  },
  {
    name: 'work.sprint.complete',
    label: 'Complete sprints',
    description: null,
    area: 'Sprints',
    defaults: COLLEAGUES,
  },
  {
    name: 'work.sprint.manage',
    label: 'Edit and delete sprints',
    description: 'Name, goal, dates, capacity',
    area: 'Sprints',
    defaults: COLLEAGUES,
  },
  {
    name: 'work.board.configure',
    label: 'Configure board',
    description: 'Columns, lanes, cards, settings',
    area: 'Boards',
    defaults: ADMINS,
  },
  {
    name: 'work.board.method',
    label: 'Change method',
    description: 'Switch Scrum and Kanban',
    area: 'Boards',
    defaults: ADMINS,
  },
  {
    name: 'work.board.wip',
    label: 'Edit WIP limits',
    description: 'Without opening settings',
    area: 'Boards',
    defaults: ADMINS,
  },
  {
    name: 'work.workflow.configure',
    label: 'Configure workflows',
    description: 'Edit and publish statuses and transitions',
    area: 'Workflows and automation',
    defaults: ADMINS,
  },
  {
    name: 'work.automation.edit',
    label: 'Edit automation',
    description: 'Create, change, pause and delete rules',
    area: 'Workflows and automation',
    defaults: ADMINS,
  },
] as const satisfies readonly WorkActionDefinition[];

export type WorkAction = (typeof WORK_ACTIONS)[number]['name'];

export const WORK_ACTION_NAMES: readonly WorkAction[] = WORK_ACTIONS.map((action) => action.name);

/** What the person asking may do in one project, after their project role. */
export const projectPermissionsSchema = z.object({
  projectId: z.uuid(),
  actions: z.array(z.string()),
});

export type ProjectPermissions = z.infer<typeof projectPermissionsSchema>;
