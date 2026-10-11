import { USER_IDS } from './people.ts';
import { ago, uid } from './time.ts';
import { WEBHOOK_IDS } from './webhooks.ts';
import { WORK_IDS } from './work-settings.ts';

/*
 * Work automation as the demo shows it, in the shapes of the module's shared
 * schemas (typed loosely: apps never import a module). Three rules on the
 * project, one global, and a run log with every state, including the loop
 * guard stopping two rules that kept triggering each other.
 */

export type AutomationRow = Record<string, unknown> & { id: string; projectId: string | null };

export const RULE_IDS = {
  triage: uid(0xd00),
  release: uid(0xd01),
  stale: uid(0xd02),
  reopen: uid(0xd03),
} as const;

const OWNER = { createdBy: USER_IDS.rohan, ownerId: USER_IDS.rohan, ownerName: 'Rohan S.' };

function rule(row: Partial<AutomationRow> & { id: string; name: string }): AutomationRow {
  return {
    projectId: WORK_IDS.project,
    enabled: true,
    isDraft: false,
    conditions: [],
    aiRunId: null,
    lastRunAt: null,
    lastRunStatus: null,
    createdAt: ago(60 * 24 * 30),
    updatedAt: ago(60 * 24 * 3),
    ...OWNER,
    ...row,
  } as AutomationRow;
}

export function seedAutomationRules(): AutomationRow[] {
  return [
    rule({
      id: RULE_IDS.triage,
      name: 'Send new bugs to triage',
      trigger: { name: 'issue_created', args: {} },
      conditions: ['type = Bug'],
      actions: [
        { name: 'assign', args: { to: 'user', userId: USER_IDS.priya } },
        { name: 'add_label', args: { label: 'triage' } },
      ],
      lastRunAt: ago(18),
      lastRunStatus: 'succeeded',
    }),
    rule({
      id: RULE_IDS.release,
      name: 'Tell the platform channel when work is done',
      trigger: { name: 'issue_transitioned', args: { toStatus: 'Done' } },
      actions: [
        { name: 'add_comment', args: { body: 'Shipped. Thanks for the report.' } },
        { name: 'send_webhook', args: { webhookId: WEBHOOK_IDS.chat } },
      ],
      lastRunAt: ago(55),
      lastRunStatus: 'failed',
    }),
    rule({
      id: RULE_IDS.stale,
      name: 'Nudge reviews that wait too long',
      enabled: false,
      trigger: { name: 'scheduled', args: { cron: '0 9 * * 1-5' } },
      conditions: ['status = "Code review"'],
      actions: [
        {
          name: 'notify',
          args: {
            recipients: ['assignee'],
            userIds: [USER_IDS.priya],
            message: 'This review has been waiting since last week.',
          },
        },
      ],
    }),
    rule({
      id: RULE_IDS.reopen,
      projectId: null,
      name: 'Reopen when a customer comments on done work',
      trigger: { name: 'comment_added', args: {} },
      conditions: ['status = Done AND label = customer'],
      actions: [{ name: 'transition', args: { status: 'In progress' } }],
      lastRunAt: ago(60 * 5),
      lastRunStatus: 'skipped',
    }),
  ];
}

interface RunSeed {
  rule: keyof typeof RULE_IDS;
  name: string;
  status: string;
  trigger: string;
  issueKey: string | null;
  minutes: number;
  depth?: number;
  ms?: number | null;
  error?: string | null;
  result?: unknown;
}

const done = (...actions: [string, string][]) => ({
  conditionsMet: true,
  actions: actions.map(([name, message]) => ({ name, ok: true, message })),
});

const RUNS: RunSeed[] = [
  {
    rule: 'triage',
    name: 'Send new bugs to triage',
    status: 'succeeded',
    trigger: 'issue.created',
    issueKey: 'PLT-226',
    minutes: 18,
    ms: 142,
    result: done(['assign', 'Assigned to Priya N.'], ['add_label', 'Added the label triage']),
  },
  {
    rule: 'release',
    name: 'Tell the platform channel when work is done',
    status: 'failed',
    trigger: 'issue.transitioned',
    issueKey: 'PLT-204',
    minutes: 55,
    ms: 388,
    error: 'One action failed.',
    result: {
      conditionsMet: true,
      actions: [
        { name: 'add_comment', ok: true, message: 'Commented on PLT-204' },
        {
          name: 'send_webhook',
          ok: false,
          message: 'Platform channel answered 429 Too Many Requests.',
        },
      ],
    },
  },
  {
    rule: 'reopen',
    name: 'Reopen when a customer comments on done work',
    status: 'skipped',
    trigger: 'issue.commented',
    issueKey: 'PLT-209',
    minutes: 60 * 5,
    ms: 21,
    result: { conditionsMet: false, actions: [] },
  },
  {
    rule: 'release',
    name: 'Tell the platform channel when work is done',
    status: 'skipped',
    trigger: 'workflow',
    issueKey: 'PLT-211',
    minutes: 60 * 7,
    depth: 5,
    ms: 4,
    error: 'Stopped: rules triggered each other 5 times in a row.',
  },
  {
    rule: 'triage',
    name: 'Send new bugs to triage',
    status: 'succeeded',
    trigger: 'test',
    issueKey: 'PLT-224',
    minutes: 60 * 9,
    ms: 118,
    result: done(['assign', 'Assigned to Priya N.'], ['add_label', 'Added the label triage']),
  },
];

export function seedAutomationRuns(): AutomationRow[] {
  const projectRuns = RUNS.map((run, index) => ({
    id: uid(0xe00 + index),
    projectId: WORK_IDS.project,
    ruleId: RULE_IDS[run.rule],
    ruleName: run.name,
    status: run.status,
    trigger: run.trigger,
    issueId: null,
    issueKey: run.issueKey,
    depth: run.depth ?? 0,
    input: {},
    result: run.result ?? null,
    error: run.error ?? null,
    durationMs: run.ms ?? null,
    startedAt: ago(run.minutes),
    finishedAt: ago(run.minutes),
    createdAt: ago(run.minutes),
  }));
  // Older successes, so the log pages.
  const older = Array.from({ length: 28 }, (_, index) => ({
    ...projectRuns[0]!,
    id: uid(0xe40 + index),
    issueKey: `PLT-${180 + index}`,
    durationMs: 90 + ((index * 29) % 120),
    startedAt: ago(60 * 24 + index * 70),
    finishedAt: ago(60 * 24 + index * 70),
    createdAt: ago(60 * 24 + index * 70),
  }));
  return [...projectRuns, ...older];
}
