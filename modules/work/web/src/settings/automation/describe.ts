import {
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  automationRunResultSchema,
  type AutomationRule,
  type AutomationRun,
  type AutomationRunResult,
  type AutomationRunStatus,
} from '@bemmoly/module-work/shared';
import type { IconName } from '@bemmoly/ui/icons';

/*
 * Rules and runs in words: what a rule does in one line, how a run went, and
 * the names of the registry's fields and targets as people say them.
 */

export const WATCHED_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  priority: 'Priority',
  assigneeId: 'Assignee',
  sprintId: 'Sprint',
  estimate: 'Estimate',
  dueAt: 'Due date',
  labelIds: 'Labels',
  typeId: 'Type',
  parentId: 'Parent',
  fixVersionId: 'Fix version',
  componentId: 'Component',
};

export const SETTABLE_FIELD_LABELS: Record<string, string> = {
  priority: 'Priority',
  estimate: 'Estimate',
  dueAt: 'Due date',
  title: 'Title',
};

export const ASSIGN_LABELS: Record<string, string> = {
  user: 'A person',
  reporter: 'The reporter',
  trigger_actor: 'Whoever triggered the rule',
  unassigned: 'Nobody (unassign)',
};

export const ASSIGN_MODE_LABELS: Record<string, string> = {
  replace: 'Replace them',
  add: 'Keep them and add',
};

export const RECIPIENT_LABELS: Record<string, string> = {
  assignee: 'The assignees',
  reporter: 'The reporter',
  watchers: 'Watchers',
};

const RUN_TRIGGERS: Record<string, string> = {
  'issue.created': 'Issue created',
  'issue.updated': 'Field changed',
  'issue.transitioned': 'Issue transitioned',
  'issue.commented': 'Comment added',
  schedule: 'Schedule',
  workflow: 'Another rule',
  test: 'Test run',
};

export const runTriggerLabel = (trigger: string) => RUN_TRIGGERS[trigger] ?? trigger;

type Rule = Pick<AutomationRule, 'trigger' | 'actions'>;

const quoted = (value: unknown) => `“${String(value)}”`;

/** "When an issue moves to Done", the rule's trigger as a sentence. */
export function triggerSentence(rule: Rule): string {
  const args = rule.trigger.args;
  switch (rule.trigger.name) {
    case AUTOMATION_TRIGGERS.issueCreated:
      return 'When an issue is created';
    case AUTOMATION_TRIGGERS.commentAdded:
      return 'When someone comments';
    case AUTOMATION_TRIGGERS.fieldChanged: {
      const fields = ((args['fields'] as string[] | undefined) ?? []).map(
        (field) => WATCHED_FIELD_LABELS[field] ?? field,
      );
      return `When ${fields.join(' or ') || 'a field'} changes`;
    }
    case AUTOMATION_TRIGGERS.issueTransitioned: {
      const from = args['fromStatus'] ? ` from ${quoted(args['fromStatus'])}` : '';
      const to = args['toStatus'] ? ` to ${quoted(args['toStatus'])}` : '';
      return from || to ? `When an issue moves${from}${to}` : 'When an issue changes status';
    }
    case AUTOMATION_TRIGGERS.scheduled:
      return `On the schedule ${String(args['cron'] ?? '')} (UTC)`;
    default:
      return rule.trigger.name;
  }
}

const ACTION_WORDS: Record<string, string> = {
  [AUTOMATION_ACTIONS.setField]: 'set a field',
  [AUTOMATION_ACTIONS.transition]: 'move it',
  [AUTOMATION_ACTIONS.assign]: 'assign it',
  [AUTOMATION_ACTIONS.addComment]: 'comment',
  [AUTOMATION_ACTIONS.addLabel]: 'add a label',
  [AUTOMATION_ACTIONS.sendWebhook]: 'send a webhook',
  [AUTOMATION_ACTIONS.notify]: 'notify people',
  [AUTOMATION_ACTIONS.archive]: 'archive it',
};

/** "then assign it, add a label". */
export function actionsSentence(rule: Rule): string {
  const words = rule.actions.map((action) => ACTION_WORDS[action.name] ?? action.name);
  return words.length > 0 ? `then ${words.join(', ')}` : 'with no actions yet';
}

export interface RunLook {
  icon: IconName;
  /** A text colour class: the signal ink for the state. */
  ink: string;
  label: string;
}

const RUN_LOOKS: Record<AutomationRunStatus, RunLook> = {
  succeeded: { icon: 'circle-check', ink: 'text-green-tx', label: 'Succeeded' },
  failed: { icon: 'warning', ink: 'text-red-tx', label: 'Failed' },
  skipped: { icon: 'minus', ink: 'text-tx-2', label: 'Skipped' },
  running: { icon: 'refresh', ink: 'text-acc', label: 'Running' },
  queued: { icon: 'clock', ink: 'text-tx-2', label: 'Queued' },
};

export const runLook = (status: AutomationRunStatus) => RUN_LOOKS[status];

/** The run's recorded result, or null while it has none (queued, running, stopped early). */
export function runResult(run: Pick<AutomationRun, 'result'>): AutomationRunResult | null {
  const parsed = automationRunResultSchema.safeParse(run.result);
  return parsed.success ? parsed.data : null;
}

/** "2 of 3 done", "Conditions not met", or nothing when the run has no result. */
export function outcomeLabel(run: Pick<AutomationRun, 'result'>): string | null {
  const result = runResult(run);
  if (!result) return null;
  if (!result.conditionsMet) return 'Conditions not met';
  const ok = result.actions.filter((action) => action.ok).length;
  return `${ok} of ${result.actions.length} done`;
}

export const durationLabel = (ms: number | null) =>
  ms === null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
