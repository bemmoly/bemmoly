import { ago, ahead, uid } from './time.ts';
import {
  DAY,
  issue,
  LABEL_IDS,
  rankAt,
  BOARD_IDS,
  WHO,
  type MockIssue,
  type Who,
} from './work-board.ts';
import { STATUS_IDS, WORK_IDS, type StatusName } from './work-settings.ts';
import { TYPE_IDS } from './work-types.ts';

/* Platform Core (PLT, Scrum): the Board mock's nineteen cards, its two epics and its sprint. */

const COLUMN_STATUS: StatusName[] = ['Selected', 'In progress', 'Code review', 'Testing', 'Done'];

type Extra = { labels?: string[]; doc?: string; sub?: [number, number]; blocked?: string };
type Seed = [string, number, number, string, string, string, Who, number, Extra?];

/** The Board mock's `issues` table: key, epic, column, type, priority, title, who, points. */
const PLT: Seed[] = [
  [
    'PLT-222',
    0,
    0,
    'task',
    'medium',
    'Rate-limit token refresh endpoint',
    'AK',
    3,
    { labels: ['api'], doc: 'RFC' },
  ],
  [
    'PLT-219',
    0,
    0,
    'task',
    'low',
    'Remove legacy cookie path from monolith',
    'JM',
    2,
    { blocked: 'PLT-204' },
  ],
  [
    'PLT-211',
    0,
    0,
    'story',
    'medium',
    'Session cleanup background job',
    'JM',
    3,
    { blocked: 'PLT-204', labels: ['infra'] },
  ],
  [
    'PLT-218',
    0,
    1,
    'story',
    'highest',
    'Rotate service tokens on every deploy',
    'PN',
    5,
    { labels: ['auth', 'security'], doc: 'RFC', sub: [1, 3] },
  ],
  [
    'PLT-226',
    0,
    1,
    'bug',
    'high',
    'Refresh token reused after logout on Safari',
    'LT',
    2,
    { labels: ['security'] },
  ],
  [
    'PLT-204',
    0,
    2,
    'story',
    'highest',
    'Session store migration to Postgres',
    'AK',
    5,
    { labels: ['auth', 'infra'], doc: 'RFC', sub: [2, 4] },
  ],
  [
    'PLT-209',
    0,
    3,
    'task',
    'medium',
    'Health checks and alerting for auth service',
    'RS',
    1,
    { labels: ['ops'] },
  ],
  [
    'PLT-198',
    0,
    4,
    'story',
    'high',
    'SSO with Google Workspace and Okta',
    'PN',
    3,
    { labels: ['auth'] },
  ],
  ['PLT-197', 0, 4, 'task', 'low', 'Auth service CI pipeline', 'RS', 2],
  [
    'PLT-230',
    1,
    0,
    'story',
    'high',
    'Usage-based invoice line items',
    'LT',
    5,
    { labels: ['billing'], doc: 'Spec' },
  ],
  [
    'PLT-231',
    1,
    0,
    'task',
    'medium',
    'Proration when switching plans mid-cycle',
    'LT',
    3,
    { labels: ['billing'] },
  ],
  [
    'PLT-228',
    1,
    1,
    'story',
    'high',
    'Stripe webhook idempotency',
    'RS',
    3,
    { labels: ['billing', 'api'], sub: [0, 2] },
  ],
  [
    'PLT-224',
    1,
    2,
    'bug',
    'highest',
    'Invoice PDF shows wrong tax for EU customers',
    'JM',
    2,
    { labels: ['billing', 'bug-bash'] },
  ],
  ['PLT-215', 1, 3, 'task', 'medium', 'Dunning email sequence', 'LT', 2],
  ['PLT-201', 1, 4, 'task', 'low', 'Billing settings copy cleanup', 'JM', 1],
  [
    'PLT-233',
    2,
    0,
    'bug',
    'medium',
    'Board filter state lost on refresh',
    'JM',
    1,
    { labels: ['ux'] },
  ],
  [
    'PLT-227',
    2,
    1,
    'task',
    'low',
    'Upgrade Postgres client to 16.x',
    'RS',
    2,
    { labels: ['infra'] },
  ],
  ['PLT-212', 2, 4, 'bug', 'high', 'Avatar upload fails over 2 MB', 'AK', 1],
  ['PLT-205', 2, 4, 'task', 'medium', 'Docker compose quick-start docs', 'PN', 2, { doc: 'Guide' }],
];

const EPICS: Array<[string, string, number]> = [
  ['PLT-180', 'Auth service', 2],
  ['PLT-150', 'Billing v2', 16],
];

export function seedPlatformIssues(): MockIssue[] {
  const epics = EPICS.map(([key, title, dueDays], index) =>
    issue({
      id: uid(0xc00 + index),
      projectId: WORK_IDS.project,
      key,
      title,
      typeId: TYPE_IDS['epic'] ?? '',
      statusId: STATUS_IDS['In progress'],
      dueAt: ahead(dueDays * DAY).slice(0, 10),
      rank: rankAt(index),
    }),
  );
  const cards = PLT.map(
    ([key, epic, column, type, priority, title, who, points, extra = {}], index) => {
      const status = COLUMN_STATUS[column] ?? 'Selected';
      const age = [1, 2, 3, 1, 0][column] ?? 0;
      return issue({
        id: uid(0xc10 + index),
        projectId: WORK_IDS.project,
        key,
        title,
        typeId: TYPE_IDS[type] ?? '',
        statusId: STATUS_IDS[status],
        priority,
        assigneeId: WHO[who],
        estimate: points,
        labelIds: (extra.labels ?? []).map((name) => LABEL_IDS[name] ?? ''),
        rank: rankAt(10 + index),
        parentId: epics[epic]?.id ?? null,
        sprintId: BOARD_IDS.sprint,
        blockedBy: extra.blocked ? [extra.blocked] : [],
        docs: extra.doc ? [extra.doc] : [],
        subtasks: extra.sub ? { done: extra.sub[0], total: extra.sub[1] } : null,
        // Work past "In progress" has its PR; PLT-227 and PLT-228 do not yet, so review refuses them.
        customFields:
          key === 'PLT-227' || key === 'PLT-228'
            ? {}
            : { pr: `#${4800 + index}`, reviewer: WHO.JM },
        statusChangedAt: ago((age + (key.charCodeAt(5) % 4)) * DAY),
        updatedAt: ago(
          ['PLT-204', 'PLT-218', 'PLT-226', 'PLT-224', 'PLT-228'].includes(key) ? 120 : 3 * DAY,
        ),
      });
    },
  );
  return [...epics, ...cards];
}
