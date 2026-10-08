import { z } from 'zod';
import type {
  WorkflowRule,
  WorkflowRuleDefinition as RuleCatalogEntry,
  WorkflowRuleKind,
} from '../../../../../shared/index.ts';
import { assignToReporter } from './assign-to-reporter.ts';
import { clearSprint } from './clear-sprint.ts';
import { commentRequired } from './comment-required.ts';
import { estimateSet } from './estimate-set.ts';
import { fieldSet } from './field-set.ts';
import { fireAutomation } from './fire-automation.ts';
import { linkedIssuesResolved } from './linked-issues-resolved.ts';
import { lqlQuery } from './lql-query.ts';
import { requiredFields } from './required-fields.ts';
import { setResolution } from './set-resolution.ts';
import { subtasksDone } from './subtasks-done.ts';
import type { RuleContext, WorkflowRuleDefinition } from './types.ts';

/*
 * Every condition, validator and post-action a transition can carry. Adding
 * one is its file plus a line here; the draft validator, the transition
 * service and the editor's catalog all read this list and nothing else.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- each rule parses its own args; the registry erases them */
const DEFINITIONS: readonly WorkflowRuleDefinition<any>[] = [
  fieldSet,
  subtasksDone,
  linkedIssuesResolved,
  lqlQuery,
  requiredFields,
  estimateSet,
  commentRequired,
  assignToReporter,
  clearSprint,
  setResolution,
  fireAutomation,
];
/* eslint-enable @typescript-eslint/no-explicit-any */

const registry = new Map<string, WorkflowRuleDefinition>(
  DEFINITIONS.map((rule) => [rule.name, rule]),
);

export function findRule(name: string): WorkflowRuleDefinition | undefined {
  return registry.get(name);
}

/** The slot a rule belongs in; a validator listed under conditions is a draft problem. */
export const RULE_SLOTS: Record<'conditions' | 'validators' | 'postActions', WorkflowRuleKind> = {
  conditions: 'condition',
  validators: 'validator',
  postActions: 'post_action',
};

/** Parsed arguments, or the message to show; the draft validator and the gate both need it. */
export function parseRuleArgs(
  rule: WorkflowRuleDefinition,
  args: Record<string, unknown>,
): { ok: true; args: unknown } | { ok: false; message: string } {
  const parsed = rule.params.safeParse(args);
  if (parsed.success) return { ok: true, args: parsed.data };
  const issue = parsed.error.issues[0];
  const path = issue?.path.map(String).join('.');
  return { ok: false, message: `${path ? `${path}: ` : ''}${issue?.message ?? 'invalid'}` };
}

/** What the editor's rule picker lists, with params as JSON Schema. */
export function ruleCatalog(deps: Pick<RuleContext, 'lql' | 'jobs'>): RuleCatalogEntry[] {
  return DEFINITIONS.map((rule) => ({
    name: rule.name,
    kind: rule.kind,
    label: rule.label,
    description: rule.description,
    params: z.toJSONSchema(rule.params as z.ZodType, { io: 'input' }) as Record<string, unknown>,
    available: rule.available ? rule.available(deps) : true,
  }));
}

export type RuleOutcomes = { ok: true } | { ok: false; reasons: string[] };

/** Runs every rule of one slot and collects every failure, so the UI can show all at once. */
export async function runChecks(
  rules: readonly WorkflowRule[],
  kind: 'condition' | 'validator',
  context: RuleContext,
): Promise<RuleOutcomes> {
  const reasons: string[] = [];
  for (const entry of rules) {
    const rule = findRule(entry.name);
    if (!rule || rule.kind !== kind) {
      reasons.push(`Unknown ${kind} "${entry.name}"`);
      continue;
    }
    const args = parseRuleArgs(rule, entry.args);
    if (!args.ok) {
      reasons.push(`${rule.label}: ${args.message}`);
      continue;
    }
    const outcome =
      rule.kind === 'condition'
        ? await rule.check(args.args, context)
        : await rule.validate(args.args, context);
    if (!outcome.ok) reasons.push(outcome.reason);
  }
  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

export async function runPostAction(entry: WorkflowRule, context: RuleContext): Promise<void> {
  const rule = findRule(entry.name);
  if (!rule || rule.kind !== 'post_action') return;
  const args = parseRuleArgs(rule, entry.args);
  if (!args.ok) return;
  await rule.run(args.args, context);
}

export type { RuleContext, RuleOutcome, WorkflowRuleDefinition } from './types.ts';
