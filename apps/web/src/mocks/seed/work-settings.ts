import { ROLE_IDS } from './people.ts';
import { ago, uid } from './time.ts';

/*
 * The Board Settings and Workflow mocks as data, in the shapes of the work
 * module's shared schemas (typed loosely here: apps never import a module).
 * The org default scheme rows have no projectId; the project rows that
 * override them point back with originId.
 */

export const WORK_IDS = {
  project: uid(0x900),
  orgBoard: uid(0x901),
  board: uid(0x902),
  orgWorkflow: uid(0x903),
  workflow: uid(0x904),
} as const;

const STATUS_NAMES = [
  'Backlog',
  'Selected',
  'In progress',
  'Code review',
  'Design review',
  'Testing',
  'Done',
  "Won't do",
  'Duplicate',
] as const;

export type StatusName = (typeof STATUS_NAMES)[number];

export const STATUS_IDS = Object.fromEntries(
  STATUS_NAMES.map((name, index) => [name, uid(0x920 + index)]),
) as Record<StatusName, string>;

const stamp = { createdAt: ago(60 * 24 * 40), updatedAt: ago(60 * 24 * 2) };

export interface WorkStatusRow {
  id: string;
  workflowId: string;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  color: string | null;
  position: number;
  allowedRoleIds: string[];
  x: number;
  y: number;
}

type StatusSeed = [StatusName, WorkStatusRow['category'], string | null, number, number];

/** Node positions from the Workflow mock's `N` table; the two extra statuses sit beside them. */
const STATUSES: StatusSeed[] = [
  ['Backlog', 'todo', null, 110, 120],
  ['Selected', 'todo', null, 300, 120],
  ['In progress', 'in_progress', null, 490, 120],
  ['Code review', 'in_progress', '#8b5cf6', 680, 120],
  ['Design review', 'in_progress', '#8b5cf6', 490, 300],
  ['Testing', 'in_progress', '#d49a1a', 680, 300],
  ['Done', 'done', null, 870, 300],
  ["Won't do", 'done', null, 300, 420],
  ['Duplicate', 'done', null, 110, 420],
];

export function seedWorkStatuses(workflowId: string): WorkStatusRow[] {
  return STATUSES.map(([name, category, color, x, y], position) => ({
    id: STATUS_IDS[name],
    workflowId,
    name,
    category,
    color,
    position,
    allowedRoleIds: [ROLE_IDS.projectAdmin, ROLE_IDS.member],
    x,
    y,
  }));
}

export interface WorkTransitionRow {
  id: string;
  workflowId: string;
  fromStatusId: string | null;
  toStatusId: string;
  name: string;
  rules: {
    conditions: Array<{ name: string; args: Record<string, unknown> }>;
    validators: Array<{ name: string; args: Record<string, unknown> }>;
    postActions: Array<{ name: string; args: Record<string, unknown> }>;
  };
  position: number;
}

type TransitionSeed = [StatusName | null, StatusName, string];

/** The Workflow mock's `E` table; "Close" is the Any transition. */
const TRANSITIONS: TransitionSeed[] = [
  ['Backlog', 'Selected', 'Select for sprint'],
  ['Selected', 'In progress', 'Start work'],
  ['In progress', 'Code review', 'Open PR'],
  ['Code review', 'Testing', 'Approve'],
  ['Code review', 'In progress', 'Request changes'],
  ['Testing', 'Done', 'Pass QA'],
  ['Testing', 'In progress', 'Fail QA'],
  [null, "Won't do", 'Close'],
];

type Rules = WorkTransitionRow['rules'];

/** Names and arguments from the server's rules registry, which seed/work-rules.ts mirrors. */
const RULES: Partial<Record<string, Rules>> = {
  'Open PR': {
    conditions: [{ name: 'field_set', args: { field: 'pullRequest' } }],
    validators: [{ name: 'required_fields', args: { fields: ['reviewer'] } }],
    postActions: [],
  },
  'Pass QA': {
    conditions: [{ name: 'subtasks_done', args: {} }],
    validators: [],
    postActions: [{ name: 'set_resolution', args: { resolved: true } }],
  },
  'Fail QA': {
    conditions: [],
    validators: [{ name: 'comment_required', args: { minLength: 10 } }],
    postActions: [],
  },
  Close: {
    conditions: [],
    validators: [{ name: 'comment_required', args: { minLength: 1 } }],
    postActions: [
      { name: 'clear_sprint', args: {} },
      { name: 'set_resolution', args: { resolved: true } },
    ],
  },
};

const noRules = (): Rules => ({ conditions: [], validators: [], postActions: [] });

export function seedWorkTransitions(workflowId: string): WorkTransitionRow[] {
  return TRANSITIONS.map(([from, to, name], position) => ({
    id: uid(0x940 + position),
    workflowId,
    fromStatusId: from ? STATUS_IDS[from] : null,
    toStatusId: STATUS_IDS[to],
    name,
    rules: structuredClone(RULES[name] ?? noRules()),
    position,
  }));
}

/** "Backlog · 42 issues": the counts on the canvas nodes and the column status pills. */
export const STATUS_COUNTS: Record<string, number> = {
  [STATUS_IDS.Backlog]: 42,
  [STATUS_IDS.Selected]: 9,
  [STATUS_IDS['In progress']]: 4,
  [STATUS_IDS['Code review']]: 2,
  [STATUS_IDS['Design review']]: 0,
  [STATUS_IDS.Testing]: 2,
  [STATUS_IDS.Done]: 9,
  [STATUS_IDS["Won't do"]]: 3,
  [STATUS_IDS.Duplicate]: 1,
};

export function seedWorkProject() {
  return {
    id: WORK_IDS.project,
    key: 'PLT',
    name: 'Platform Core',
    description: 'The platform team',
    teamId: null,
    method: 'scrum',
    /** Fields and the board are project copies; types and the workflow inherit. */
    schemeOverrides: { fields: true, board: true },
    defaultSpaceId: null,
    archivedAt: null,
    ...stamp,
  };
}

const boardColumns = () => [
  {
    id: 'todo',
    name: 'To do',
    statusIds: [STATUS_IDS.Backlog, STATUS_IDS.Selected],
    wipLimit: null,
    done: false,
  },
  {
    id: 'progress',
    name: 'In progress',
    statusIds: [STATUS_IDS['In progress']],
    wipLimit: 4,
    done: false,
  },
  {
    id: 'review',
    name: 'In review',
    statusIds: [STATUS_IDS['Code review'], STATUS_IDS['Design review']],
    wipLimit: null,
    done: false,
  },
  { id: 'qa', name: 'QA', statusIds: [STATUS_IDS.Testing], wipLimit: null, done: false },
  { id: 'done', name: 'Done', statusIds: [STATUS_IDS.Done], wipLimit: null, done: true },
];

/** The Board Settings mock's state block; the org default differs in the two overridden settings. */
export function seedWorkBoards() {
  const config = {
    columns: boardColumns(),
    collapseEmptyColumns: true,
    showColumnCounts: true,
    showUnassigned: false,
    lanes: {
      kind: 'epic',
      queries: [
        { name: 'Expedite', query: 'priority = Highest' },
        { name: 'Customer bugs', query: 'type = Bug AND label = customer' },
        { name: 'Tech debt', query: 'label = tech-debt' },
      ],
      showEmpty: false,
      collapsible: true,
      totals: true,
    },
    cardFields: ['type', 'key', 'priority', 'labels', 'estimate', 'assignee', 'docs', 'blocked'],
    colorRule: 'none',
    estimationUnit: 'points',
    cadenceDays: 14,
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    quickFilters: [],
    colors: {},
  };
  const orgConfig = {
    ...config,
    columns: config.columns.map((column) => ({ ...column, wipLimit: null })),
    lanes: { ...config.lanes, kind: 'none', queries: [] },
  };
  return [
    {
      id: WORK_IDS.orgBoard,
      projectId: null,
      originId: null,
      name: 'Software (Scrum)',
      config: orgConfig,
      ...stamp,
    },
    {
      id: WORK_IDS.board,
      projectId: WORK_IDS.project,
      originId: WORK_IDS.orgBoard,
      name: 'PLT board',
      config,
      ...stamp,
    },
  ];
}

export function seedWorkWorkflows() {
  const workflow = (id: string, projectId: string | null, originId: string | null) => ({
    id,
    projectId,
    originId,
    name: 'Software workflow',
    publishedVersion: 3,
    hasDraft: false,
    draft: null as unknown,
    statuses: seedWorkStatuses(id),
    transitions: seedWorkTransitions(id),
    ...stamp,
  });
  return [
    workflow(WORK_IDS.orgWorkflow, null, null),
    workflow(WORK_IDS.workflow, WORK_IDS.project, WORK_IDS.orgWorkflow),
  ];
}
