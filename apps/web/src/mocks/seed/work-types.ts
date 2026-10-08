import { ago, uid } from './time.ts';
import { WORK_IDS } from './work-settings.ts';

/* The Workflow mock's `typeDefs` and `fieldSets` tables as org defaults and project rows. */

const stamp = { createdAt: ago(60 * 24 * 40), updatedAt: ago(60 * 24 * 2) };

type TypeSeed = [string, string, string, string, 'epic' | 'standard' | 'subtask', string, boolean];

const TYPES: TypeSeed[] = [
  ['epic', 'Epic', '#8b5cf6', '◆', 'epic', 'Large body of work spanning sprints', false],
  [
    'story',
    'Story',
    '#2b9b5a',
    '▮',
    'standard',
    'User-facing functionality, estimated in points',
    false,
  ],
  ['bug', 'Bug', '#d93838', '●', 'standard', 'A defect in shipped behavior', false],
  ['task', 'Task', '#2456c9', '✓', 'standard', 'Technical or operational work', false],
  [
    'incident',
    'Incident',
    '#e0632a',
    '!',
    'standard',
    'Production incident with severity and timeline',
    true,
  ],
  ['subtask', 'Subtask', '#6b7483', '–', 'subtask', 'Child of any standard issue', false],
];

export const TYPE_IDS = Object.fromEntries(
  TYPES.map(([key], index) => [key, uid(0x960 + index)]),
) as Record<string, string>;

/** "142 issues" under each type in the list. */
export const TYPE_COUNTS: Record<string, number> = { story: 142, bug: 38, task: 96, incident: 4 };

export function seedWorkIssueTypes() {
  return TYPES.map(([key, name, color, icon, level, description, project], position) => ({
    id: TYPE_IDS[key] ?? '',
    projectId: project ? WORK_IDS.project : null,
    originId: null,
    key,
    name,
    description,
    icon,
    color,
    level,
    position,
    ...stamp,
  }));
}

type FieldSeed = [string, string, string, boolean, boolean];

/** key, name, kind, filterable, aiFill. Project-only fields are the Incident ones. */
const FIELDS: FieldSeed[] = [
  ['summary', 'Summary', 'text', true, false],
  ['description', 'Description', 'richtext', false, false],
  ['assignee', 'Assignee', 'user', true, false],
  ['priority', 'Priority', 'select', true, false],
  ['labels', 'Labels', 'multiselect', true, false],
  ['epic', 'Epic', 'select', true, false],
  ['sprint', 'Sprint', 'select', true, false],
  ['fix_version', 'Fix version', 'select', true, false],
  ['linked_docs', 'Linked docs', 'doc', false, true],
  ['story_points', 'Story points', 'number', true, true],
  ['acceptance_criteria', 'Acceptance criteria', 'richtext', false, false],
  ['design_link', 'Design link', 'url', false, false],
  ['severity', 'Severity', 'select', true, false],
  ['environment', 'Environment', 'select', true, false],
  ['steps', 'Steps to reproduce', 'richtext', false, false],
  ['affected_version', 'Affected version', 'select', true, false],
  ['due_date', 'Due date', 'date', true, false],
  ['target_date', 'Target date', 'date', true, false],
  ['owner', 'Owner', 'user', true, false],
  ['objective', 'Objective', 'select', true, false],
  ['started_at', 'Started at', 'datetime', true, false],
  ['customer_impact', 'Customer impact', 'richtext', false, false],
  ['postmortem_doc', 'Postmortem doc', 'doc', false, false],
  ['estimate', 'Estimate', 'number', true, false],
];

const PROJECT_FIELDS = new Set(['started_at', 'customer_impact', 'postmortem_doc']);

export const FIELD_IDS = Object.fromEntries(
  FIELDS.map(([key], index) => [key, uid(0x980 + index)]),
) as Record<string, string>;

const SELECT_OPTIONS: Record<string, string[]> = {
  priority: ['Highest', 'High', 'Medium', 'Low', 'Lowest'],
  severity: ['Sev1', 'Sev2', 'Sev3'],
  environment: ['Production', 'Staging', 'Development'],
  objective: ['Reliability', 'Growth', 'Platform'],
};

export function seedWorkFields() {
  return FIELDS.map(([key, name, kind, filterable, aiFill]) => ({
    id: FIELD_IDS[key] ?? '',
    projectId: PROJECT_FIELDS.has(key) ? WORK_IDS.project : null,
    originId: null,
    key,
    name,
    kind,
    options: (SELECT_OPTIONS[key] ?? []).map((value) => ({
      value: value.toLowerCase(),
      label: value,
    })),
    filterable,
    aiFill,
    ...stamp,
  }));
}

type LayoutSeed = [string, boolean, boolean];

const COMMON: LayoutSeed[] = [
  ['summary', true, false],
  ['description', false, false],
  ['assignee', false, true],
  ['priority', true, true],
  ['labels', false, true],
  ['epic', false, false],
  ['sprint', false, false],
  ['fix_version', false, false],
  ['linked_docs', false, true],
];

const PER_TYPE: Record<string, LayoutSeed[]> = {
  story: [
    ['story_points', false, true],
    ['acceptance_criteria', true, false],
    ['design_link', false, false],
  ],
  bug: [
    ['severity', true, true],
    ['environment', true, false],
    ['steps', true, false],
    ['affected_version', false, false],
  ],
  task: [
    ['story_points', false, true],
    ['due_date', false, true],
  ],
  epic: [
    ['target_date', true, false],
    ['owner', true, false],
    ['objective', false, false],
  ],
  incident: [
    ['severity', true, true],
    ['started_at', true, false],
    ['customer_impact', true, false],
    ['postmortem_doc', false, true],
  ],
  subtask: [['estimate', false, true]],
};

export function seedWorkTypeFields() {
  let n = 0;
  return TYPES.flatMap(([key]) =>
    [...COMMON, ...(PER_TYPE[key] ?? [])].map(([fieldKey, required, onCard], position) => ({
      id: uid(0xa00 + n++),
      issueTypeId: TYPE_IDS[key] ?? '',
      fieldId: FIELD_IDS[fieldKey] ?? '',
      required,
      onCard,
      position,
    })),
  );
}

/** The rules registry as the editor lists it; names are what transitions store. */
export function seedWorkRules() {
  return [
    {
      name: 'pr_linked',
      kind: 'condition',
      label: 'A pull request must be linked',
      description: 'Blocks the move until a PR links to the issue.',
      params: [],
    },
    {
      name: 'role_is',
      kind: 'condition',
      label: 'Person has role',
      description: 'Only people with the role can move it.',
      params: [{ key: 'role', label: 'Role', type: 'role', required: true, options: [] }],
    },
    {
      name: 'field_not_empty',
      kind: 'validator',
      label: 'Field is not empty',
      description: 'The field must hold a value before the move.',
      params: [{ key: 'field', label: 'Field', type: 'field', required: true, options: [] }],
    },
    {
      name: 'estimate_set',
      kind: 'validator',
      label: 'Estimate is set',
      description: 'The issue needs an estimate.',
      params: [],
    },
    {
      name: 'notify',
      kind: 'post',
      label: 'Notify',
      description: 'Sends an inbox notification.',
      params: [
        {
          key: 'who',
          label: 'Who',
          type: 'select',
          required: true,
          options: [
            { value: 'reviewers', label: 'Reviewers' },
            { value: 'assignee', label: 'Assignee' },
            { value: 'watchers', label: 'Watchers' },
          ],
        },
      ],
    },
    {
      name: 'start_timer',
      kind: 'post',
      label: 'Start timer',
      description: 'Starts a named timer for cycle time.',
      params: [{ key: 'name', label: 'Timer name', type: 'text', required: true, options: [] }],
    },
    {
      name: 'assign_to',
      kind: 'post',
      label: 'Assign to',
      description: 'Sets the assignee.',
      params: [{ key: 'user', label: 'Person', type: 'user', required: true, options: [] }],
    },
    {
      name: 'record_history',
      kind: 'post',
      label: 'Record status change in history',
      description: 'Always on; shown for completeness.',
      params: [],
    },
  ];
}
