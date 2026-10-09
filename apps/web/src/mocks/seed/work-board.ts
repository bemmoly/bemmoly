import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';
import { LABEL_IDS as ISSUE_LABEL_IDS } from './work-issues.ts';
import { STATUS_IDS } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/*
 * The Board mock's data: the issue shape the board keeps (the issue mock in work-issues.ts
 * keeps the Issue page's fuller rows; shared issues have the same ids there), labels and
 * ranks. The cards themselves are in work-board-plt.ts and work-board-sup.ts.
 */

export const BOARD_IDS = {
  supProject: uid(0xe00),
  supBoard: uid(0xe01),
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
  /** What the mock's transition rules read: the pull request and the reviewer. */
  customFields: Record<string, unknown>;
  statusChangedAt: string;
  updatedAt: string;
}

/** The board's labels beyond the issue mock's auth, infra and customer, which keep its ids. */
const LABELS = ['api', 'security', 'billing', 'ops', 'bug-bash', 'ux'];

export const LABEL_IDS: Record<string, string> = {
  ...ISSUE_LABEL_IDS,
  ...Object.fromEntries(LABELS.map((name, index) => [name, uid(0xe10 + index)])),
};

export function seedBoardLabels(projectId: string, names: readonly string[] = LABELS) {
  return names.map((name) => ({
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
