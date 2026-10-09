import { ago, uid } from './time.ts';
import { BOARD_IDS, DAY, issue, LABEL_IDS, rankAt, WHO, type MockIssue } from './work-board.ts';
import { STATUS_IDS, type StatusName } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/* Support Desk (SUP, Kanban): 500 generated cards, so the board is checked at full size. */

const TITLES = [
  'Customer cannot reset password from the mobile app',
  'Export of invoices times out for large accounts',
  'Webhook retries flood the partner endpoint',
  'SSO login loops when the session cookie expires',
  'Search misses issues created in the last minute',
  'Attachment preview is blank for HEIC images',
  'Weekly digest email arrives twice',
  'Audit log filter ignores the date range',
];
const SUP_SPREAD: Array<[StatusName, number]> = [
  ['Selected', 200],
  ['In progress', 60],
  ['Code review', 60],
  ['Testing', 60],
  ['Done', 120],
];
const PEOPLE = [...Object.values(WHO), null];
const TYPES = ['task', 'bug', 'story'];
const PRIORITIES = ['highest', 'high', 'medium', 'medium', 'low', 'lowest'];

/** 500 Support Desk cards, the same every load: a board at the size the budget names. */
export function seedSupportIssues(): MockIssue[] {
  const out: MockIssue[] = [];
  let n = 0;
  for (const [status, count] of SUP_SPREAD) {
    for (let i = 0; i < count; i++, n++) {
      out.push(
        issue({
          id: uid(0xd000 + n),
          projectId: BOARD_IDS.supProject,
          key: `SUP-${n + 1}`,
          title: `${TITLES[n % TITLES.length]} (${n + 1})`,
          typeId: TYPE_IDS[TYPES[n % TYPES.length] ?? 'task'] ?? '',
          statusId: STATUS_IDS[status],
          priority: PRIORITIES[(n * 7) % PRIORITIES.length] ?? 'medium',
          assigneeId: PEOPLE[(n * 7) % PEOPLE.length] ?? null,
          estimate: [1, 2, 3, 5][n % 4] ?? 1,
          labelIds: n % 3 === 0 ? [LABEL_IDS['customer'] ?? ''] : [],
          rank: rankAt(n),
          blockedBy: n % 41 === 7 ? [`SUP-${n}`] : [],
          customFields: { pullRequest: `#${n}`, reviewer: WHO.JM },
          statusChangedAt: ago(((n * 5) % 9) * DAY + 30),
          updatedAt: ago(((n * 11) % 30) * 60 * 6),
        }),
      );
    }
  }
  return out;
}

export function seedSupportProject() {
  return {
    id: BOARD_IDS.supProject,
    key: 'SUP',
    name: 'Support Desk',
    description: 'Customer-facing fixes, pulled continuously',
    teamId: null,
    method: 'kanban',
    schemeOverrides: { board: true },
    defaultSpaceId: null,
    archivedAt: null,
    createdAt: ago(60 * DAY),
    updatedAt: ago(DAY),
  };
}
