import { USER_IDS } from './people.ts';
import { ago, ahead, uid } from './time.ts';
import { STATUS_IDS, WORK_IDS } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/*
 * The Board mock's data: the issue shape the mock backend keeps, labels, ranks and the PLT
 * sprints. The cards themselves are in work-board-plt.ts and work-board-sup.ts.
 */

export const BOARD_IDS = {
  supProject: uid(0xb00),
  supBoard: uid(0xb01),
  sprint: uid(0xb02),
  lastSprint: uid(0xb03),
} as const;

export interface MockIssue {
  id: string;
  projectId: string;
  key: string;
  title: string;
  typeId: string;
  statusId: string;
  priority: string;
  assigneeId: string | null;
  estimate: number | null;
  labelIds: string[];
  rank: string;
  parentId: string | null;
  sprintId: string | null;
  dueAt: string | null;
  blockedBy: string[];
  docs: string[];
  subtasks: { done: number; total: number } | null;
  /** What the mock's transition rules read: a linked PR and a reviewer. */
  customFields: Record<string, unknown>;
  statusChangedAt: string;
  updatedAt: string;
}

const LABELS = ['api', 'infra', 'auth', 'security', 'billing', 'ops', 'bug-bash', 'ux', 'customer'];

export const LABEL_IDS = Object.fromEntries(
  LABELS.map((name, index) => [name, uid(0xb10 + index)]),
) as Record<string, string>;

export function seedBoardLabels(projectId: string) {
  return LABELS.map((name) => ({
    id: LABEL_IDS[name] ?? '',
    projectId,
    name,
    color: null,
    createdAt: ago(60 * 24 * 30),
    updatedAt: ago(60 * 24 * 30),
  }));
}

/** Ranks in list order: "b" plus two base-26 digits, never ending in "a". */
export function rankAt(index: number): string {
  const rank = `b${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(97 + (index % 26))}`;
  return rank.endsWith('a') ? `${rank}n` : rank;
}

export const WHO = {
  AK: USER_IDS.aisha,
  JM: USER_IDS.jonas,
  PN: USER_IDS.priya,
  RS: USER_IDS.rohan,
  LT: USER_IDS.lena,
} as const;
export type Who = keyof typeof WHO;

export const DAY = 60 * 24;

export function issue(
  fields: Partial<MockIssue> & Pick<MockIssue, 'id' | 'projectId' | 'key' | 'title'>,
): MockIssue {
  return {
    typeId: TYPE_IDS['task'] ?? '',
    statusId: STATUS_IDS.Selected,
    priority: 'medium',
    assigneeId: null,
    estimate: null,
    labelIds: [],
    rank: 'n',
    parentId: null,
    sprintId: null,
    dueAt: null,
    blockedBy: [],
    docs: [],
    subtasks: null,
    customFields: {},
    statusChangedAt: ago(DAY),
    updatedAt: ago(DAY),
    ...fields,
  };
}

export function seedBoardSprints() {
  const base = {
    projectId: WORK_IDS.project,
    capacityPoints: 24,
    createdAt: ago(30 * DAY),
    updatedAt: ago(DAY),
  };
  return [
    {
      ...base,
      id: BOARD_IDS.lastSprint,
      name: 'PLT Sprint 13',
      goal: null,
      state: 'closed',
      startsAt: ago(26 * DAY),
      endsAt: ago(12 * DAY),
      completedSnapshot: null,
      startedAt: ago(26 * DAY),
      closedAt: ago(12 * DAY),
    },
    {
      ...base,
      id: BOARD_IDS.sprint,
      name: 'PLT Sprint 14',
      goal: 'Auth service in production behind flag',
      state: 'active',
      startsAt: ago(12 * DAY),
      endsAt: ahead(2 * DAY),
      completedSnapshot: null,
      startedAt: ago(12 * DAY),
      closedAt: null,
    },
  ];
}
