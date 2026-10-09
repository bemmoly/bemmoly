import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';
import { STATUS_IDS, WORK_IDS, type StatusName } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/*
 * The Backlog mock's `groups` and `epicsRaw` tables as issues and sprints, in
 * the shapes of the work module's shared schemas (typed loosely: apps never
 * import a module). The mock's statuses are the board's column names; each
 * maps to the seeded workflow status that column holds.
 */

export interface BacklogIssueRow {
  id: string;
  projectId: string;
  number: number;
  key: string;
  typeId: string;
  title: string;
  description: null;
  descriptionText: string;
  statusId: string;
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  assigneeId: string | null;
  reporterId: string | null;
  parentId: string | null;
  sprintId: string | null;
  estimate: number | null;
  dueAt: string | null;
  fixVersionId: null;
  componentId: null;
  customFields: Record<string, unknown>;
  labelIds: string[];
  rank: string;
  statusChangedAt: string;
  resolvedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogSprintRow {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startsAt: string | null;
  endsAt: string | null;
  state: 'future' | 'active' | 'closed';
  capacityPoints: number | null;
  completedSnapshot: unknown;
  startedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const BACKLOG_SPRINT_IDS = {
  sprint13: uid(0xa00),
  sprint14: uid(0xa01),
  sprint15: uid(0xa02),
} as const;

const COLUMN_STATUS: Record<string, StatusName> = {
  'To do': 'Selected',
  'In progress': 'In progress',
  'In review': 'Code review',
  QA: 'Testing',
  Done: 'Done',
};

const PEOPLE: Record<string, string | null> = {
  PN: USER_IDS.priya,
  AK: USER_IDS.aisha,
  JM: USER_IDS.jonas,
  RS: USER_IDS.rohan,
  LT: USER_IDS.lena,
  '': null,
};

type Priority = BacklogIssueRow['priority'];
type Row = [number, string, string, string, string, Priority, number, string];

/** [number, type, title, epic number, board column, priority, points, assignee initials]. */
const SPRINT_14: Row[] = [
  [204, 'story', 'Session store migration to Postgres', '180', 'In review', 'highest', 5, 'AK'],
  [218, 'story', 'Rotate service tokens on every deploy', '180', 'In progress', 'highest', 5, 'PN'],
  [
    226,
    'bug',
    'Refresh token reused after logout on Safari',
    '180',
    'In progress',
    'high',
    2,
    'LT',
  ],
  [211, 'story', 'Session cleanup background job', '180', 'To do', 'medium', 3, 'JM'],
  [219, 'task', 'Remove legacy cookie path from monolith', '180', 'To do', 'low', 2, 'JM'],
  [228, 'story', 'Stripe webhook idempotency', '150', 'In progress', 'high', 3, 'RS'],
  [
    224,
    'bug',
    'Invoice PDF shows wrong tax for EU customers',
    '150',
    'In review',
    'highest',
    2,
    'JM',
  ],
];

const SPRINT_15: Row[] = [
  [222, 'task', 'Rate-limit token refresh endpoint', '180', 'To do', 'medium', 3, 'AK'],
  [230, 'story', 'Usage-based invoice line items', '150', 'To do', 'high', 5, 'LT'],
  [231, 'task', 'Proration when switching plans mid-cycle', '150', 'To do', 'medium', 3, 'LT'],
  [225, 'task', 'Audit log export to S3', '240', 'To do', 'medium', 5, 'RS'],
  [241, 'story', 'Structured logging across services', '240', 'To do', 'high', 3, ''],
];

const BACKLOG: Row[] = [
  [242, 'story', 'Trace IDs in HTTP responses', '240', 'To do', 'medium', 2, ''],
  [243, 'task', 'Grafana dashboards for auth service', '240', 'To do', 'low', 3, ''],
  [233, 'bug', 'Board filter state lost on refresh', '160', 'To do', 'medium', 1, 'JM'],
  [235, 'story', 'Invite teammates during setup', '160', 'To do', 'high', 3, ''],
  [236, 'task', 'Import from CSV', '160', 'To do', 'high', 5, ''],
  [237, 'task', 'Import from a wiki export', '160', 'To do', 'medium', 5, ''],
  [244, 'bug', 'Dark theme: low contrast on QA badge', '160', 'To do', 'low', 1, ''],
  [245, 'story', 'Webhooks for issue events', '240', 'To do', 'medium', 3, ''],
];

/** Finished work in the closed sprint: it never shows, but it moves the epic panel's progress. */
const FINISHED: Row[] = [
  [170, 'story', 'Session schema design', '180', 'Done', 'high', 13, 'AK'],
  [171, 'task', 'Token signing keys in the vault', '180', 'Done', 'medium', 10, 'PN'],
  [172, 'story', 'Login rate limiting', '180', 'Done', 'high', 8, 'LT'],
  [151, 'task', 'Plan catalogue table', '150', 'Done', 'medium', 1, 'RS'],
  [152, 'task', 'Tax rates per region', '150', 'Done', 'medium', 1, 'JM'],
  [153, 'task', 'Invoice numbering', '150', 'Done', 'low', 1, 'JM'],
  [154, 'task', 'Billing email templates', '150', 'Done', 'low', 1, 'LT'],
  [155, 'task', 'Currency formatting', '150', 'Done', 'low', 1, 'LT'],
  [156, 'task', 'Billing settings page', '150', 'Done', 'medium', 1, 'RS'],
  [157, 'task', 'Credit notes', '150', 'Done', 'low', 0.5, 'RS'],
  [158, 'task', 'Receipt footer', '150', 'Done', 'low', 0.5, 'JM'],
  [161, 'story', 'Workspace setup wizard', '160', 'Done', 'high', 30, 'PN'],
  [162, 'story', 'Sample project on first run', '160', 'Done', 'medium', 30, 'AK'],
  [163, 'story', 'First-run checklist', '160', 'Done', 'medium', 25, 'JM'],
];

/** [number, title]: the epics of the panel, in its order. */
const EPICS: Array<[number, string]> = [
  [180, 'Auth service'],
  [150, 'Billing v2'],
  [240, 'Observability'],
  [160, 'Self-serve onboarding'],
];

/** "bb", "bc", … : evenly spaced ranks with room on both sides of every row. */
export function seedRank(index: number): string {
  const letter = (value: number) => String.fromCharCode(98 + value);
  return `${letter(Math.floor(index / 25) % 25)}${letter(index % 25)}`;
}

const issueId = (number: number) => uid(0xb00 + number);
const stamp = { createdAt: ago(60 * 24 * 20), updatedAt: ago(60 * 3) };

export function backlogIssue(
  fields: Partial<BacklogIssueRow> & Pick<BacklogIssueRow, 'id' | 'number' | 'title' | 'rank'>,
): BacklogIssueRow {
  return {
    projectId: WORK_IDS.project,
    key: `PLT-${fields.number}`,
    typeId: TYPE_IDS['task'] ?? '',
    description: null,
    descriptionText: '',
    statusId: STATUS_IDS.Backlog,
    priority: 'medium',
    assigneeId: null,
    reporterId: USER_IDS.rohan,
    parentId: null,
    sprintId: null,
    estimate: null,
    dueAt: null,
    fixVersionId: null,
    componentId: null,
    customFields: {},
    labelIds: [],
    statusChangedAt: stamp.updatedAt,
    resolvedAt: null,
    deletedAt: null,
    ...stamp,
    ...fields,
  };
}

export function seedBacklogIssues(): BacklogIssueRow[] {
  let index = 0;
  const rows = (list: Row[], sprintId: string | null) =>
    list.map(([number, type, title, epic, column, priority, points, who]) =>
      backlogIssue({
        id: issueId(number),
        number,
        title,
        rank: seedRank((index += 2)),
        typeId: TYPE_IDS[type] ?? '',
        statusId: STATUS_IDS[COLUMN_STATUS[column] ?? 'Backlog'],
        priority,
        assigneeId: PEOPLE[who] ?? null,
        parentId: issueId(Number(epic)),
        sprintId,
        estimate: points,
        resolvedAt: column === 'Done' ? ago(60 * 24 * 16) : null,
      }),
    );
  const epics = EPICS.map(([number, title]) =>
    backlogIssue({
      id: issueId(number),
      number,
      title,
      rank: seedRank((index += 2)),
      typeId: TYPE_IDS['epic'] ?? '',
      statusId: STATUS_IDS['In progress'],
    }),
  );
  return [
    ...epics,
    ...rows(SPRINT_14, BACKLOG_SPRINT_IDS.sprint14),
    ...rows(SPRINT_15, BACKLOG_SPRINT_IDS.sprint15),
    ...rows(BACKLOG, null),
    ...rows(FINISHED, BACKLOG_SPRINT_IDS.sprint13),
  ];
}

function sprint(
  id: string,
  name: string,
  state: BacklogSprintRow['state'],
  dates: [string, string],
  capacityPoints: number | null,
  goal: string | null = null,
): BacklogSprintRow {
  return {
    id,
    projectId: WORK_IDS.project,
    name,
    goal,
    startsAt: `${dates[0]}T09:00:00.000Z`,
    endsAt: `${dates[1]}T17:00:00.000Z`,
    state,
    capacityPoints,
    completedSnapshot: null,
    startedAt: state === 'future' ? null : `${dates[0]}T09:00:00.000Z`,
    closedAt: state === 'closed' ? `${dates[1]}T17:00:00.000Z` : null,
    ...stamp,
  };
}

export function seedBacklogSprints(): BacklogSprintRow[] {
  return [
    sprint(
      BACKLOG_SPRINT_IDS.sprint13,
      'PLT Sprint 13',
      'closed',
      ['2026-09-09', '2026-09-23'],
      22,
    ),
    sprint(
      BACKLOG_SPRINT_IDS.sprint14,
      'PLT Sprint 14',
      'active',
      ['2026-09-23', '2026-10-07'],
      24,
    ),
    sprint(
      BACKLOG_SPRINT_IDS.sprint15,
      'PLT Sprint 15',
      'future',
      ['2026-10-07', '2026-10-21'],
      22,
    ),
  ];
}
