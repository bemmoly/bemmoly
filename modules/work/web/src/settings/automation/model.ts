import {
  addCommentArgsSchema,
  addLabelArgsSchema,
  assignArgsSchema,
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  fieldChangedArgsSchema,
  issueTransitionedArgsSchema,
  lqlQuerySchema,
  notifyArgsSchema,
  scheduledArgsSchema,
  sendWebhookArgsSchema,
  timeInStatusArgsSchema,
  setFieldArgsSchema,
  transitionArgsSchema,
  type AutomationRule,
  type CreateAutomationRuleBody,
} from '@bemmoly/module-work/shared';
import type { z } from 'zod';

/*
 * The rule builder's draft and how it becomes a request: arguments are
 * checked with the same schemas the registry uses, so the words under a field
 * are the server's, and every problem carries the path the server would name.
 */

export interface Step {
  /** Stable across reorders, so React keeps each editor's focus. */
  key: string;
  name: string;
  args: Record<string, unknown>;
}

export interface RuleDraft {
  name: string;
  enabled: boolean;
  trigger: Step;
  conditions: { key: string; query: string }[];
  actions: Step[];
}

export type Problems = Partial<Record<string, string>>;

let counter = 0;
export const stepKey = () => `step-${(counter += 1)}`;

/** Arguments a newly picked trigger or action starts with. */
export function startArgs(name: string): Record<string, unknown> {
  if (name === AUTOMATION_TRIGGERS.fieldChanged) return { fields: [] };
  if (name === AUTOMATION_TRIGGERS.scheduled) return { cron: '0 9 * * 1-5' };
  if (name === AUTOMATION_TRIGGERS.timeInStatus) return { status: '', amount: 5, unit: 'days' };
  if (name === AUTOMATION_ACTIONS.assign) return { to: 'reporter' };
  if (name === AUTOMATION_ACTIONS.notify)
    return { recipients: ['assignee'], userIds: [], message: '' };
  if (name === AUTOMATION_ACTIONS.setField) return { field: 'priority', value: 'high' };
  return {};
}

export const newStep = (name: string): Step => ({ key: stepKey(), name, args: startArgs(name) });

export const emptyDraft = (): RuleDraft => ({
  name: '',
  enabled: true,
  trigger: newStep(AUTOMATION_TRIGGERS.issueCreated),
  conditions: [],
  actions: [],
});

export function draftOf(rule: AutomationRule): RuleDraft {
  return {
    name: rule.name,
    enabled: rule.enabled,
    trigger: { key: stepKey(), name: rule.trigger.name, args: { ...rule.trigger.args } },
    conditions: rule.conditions.map((query) => ({ key: stepKey(), query })),
    actions: rule.actions.map((action) => ({
      key: stepKey(),
      name: action.name,
      args: { ...action.args },
    })),
  };
}

/** Empty strings mean "not set": the schemas treat a missing optional as any. */
function trimmed(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args)
      .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value] as const)
      .filter(([, value]) => value !== '' && value !== undefined),
  );
}

export function toBody(draft: RuleDraft, projectId: string | null): CreateAutomationRuleBody {
  return {
    name: draft.name.trim(),
    projectId,
    enabled: draft.enabled,
    trigger: { name: draft.trigger.name, args: trimmed(draft.trigger.args) },
    conditions: draft.conditions.map((condition) => condition.query.trim()).filter(Boolean),
    actions: draft.actions.map((action) => ({ name: action.name, args: trimmed(action.args) })),
  };
}

const TRIGGER_ARGS: Record<string, z.ZodType> = {
  [AUTOMATION_TRIGGERS.fieldChanged]: fieldChangedArgsSchema,
  [AUTOMATION_TRIGGERS.issueTransitioned]: issueTransitionedArgsSchema,
  [AUTOMATION_TRIGGERS.scheduled]: scheduledArgsSchema,
  [AUTOMATION_TRIGGERS.timeInStatus]: timeInStatusArgsSchema,
};

const ACTION_ARGS: Record<string, z.ZodType> = {
  [AUTOMATION_ACTIONS.setField]: setFieldArgsSchema,
  [AUTOMATION_ACTIONS.transition]: transitionArgsSchema,
  [AUTOMATION_ACTIONS.assign]: assignArgsSchema,
  [AUTOMATION_ACTIONS.addComment]: addCommentArgsSchema,
  [AUTOMATION_ACTIONS.addLabel]: addLabelArgsSchema,
  [AUTOMATION_ACTIONS.sendWebhook]: sendWebhookArgsSchema,
  [AUTOMATION_ACTIONS.notify]: notifyArgsSchema,
};

/** "Required" from zod reads badly under a picker; say what to do instead. */
const PLAIN: Record<string, string> = {
  status: 'Pick a status',
  label: 'Pick a label',
  body: 'Write the comment',
  message: 'Write the message',
  webhookId: 'Pick a webhook',
  userId: 'Pick the person to assign',
  field: 'Pick a field',
};

function argProblems(schema: z.ZodType | undefined, args: unknown, at: string, into: Problems) {
  if (!schema) return;
  const result = schema.safeParse(args);
  if (result.success) return;
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '');
    const path = key ? `${at}.args.${key}` : `${at}.args`;
    const plain = issue.code === 'custom' ? undefined : PLAIN[key];
    into[path] ??= plain ?? issue.message;
  }
}

/** Every reason the draft would be refused, by the path the server would name. */
export function draftProblems(
  draft: RuleDraft,
  checkQuery?: (query: string) => string | null,
): Problems {
  const problems: Problems = {};
  const body = toBody(draft, null);
  if (!body.name) problems['name'] = 'Give the rule a name';
  argProblems(TRIGGER_ARGS[body.trigger.name], body.trigger.args, 'trigger', problems);
  draft.conditions.forEach((condition, index) => {
    const query = condition.query.trim();
    const parsed = lqlQuerySchema.safeParse(query);
    const problem = parsed.success
      ? (checkQuery?.(query) ?? null)
      : 'Write a condition, or remove it';
    if (problem) problems[`conditions.${index}`] = problem;
  });
  if (body.trigger.name === AUTOMATION_TRIGGERS.scheduled && body.conditions?.length === 0) {
    problems['conditions'] = 'A scheduled rule needs a condition, or it would act on every issue';
  }
  if (body.actions.length === 0) problems['actions'] = 'Add at least one action';
  body.actions.forEach((action, index) =>
    argProblems(ACTION_ARGS[action.name], action.args, `actions.${index}`, problems),
  );
  return problems;
}

/** Moves one item a step up or down; the ends stay put. */
export function move<T>(list: readonly T[], index: number, step: -1 | 1): T[] {
  const to = index + step;
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  [next[index], next[to]] = [next[to]!, next[index]!];
  return next;
}
