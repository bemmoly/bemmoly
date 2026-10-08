import type { JobRegistry, RequestContext, SqlExecutor } from '@bemmoly/core';
import type { z } from 'zod';
import type { WorkflowRuleKind } from '../../../../../shared/index.ts';
import type { TransitionTarget, WorkflowIssue } from '../contract.ts';
import type { IssueReads, IssueWrites, LqlEvaluator } from '../deps.ts';

/** What every rule sees: the issue, where it is going and what the form sent. */
export interface RuleContext {
  ctx: RequestContext;
  sql: SqlExecutor;
  issue: WorkflowIssue;
  toStatus: TransitionTarget;
  submitted: Record<string, unknown>;
  reads: IssueReads;
  writes: IssueWrites;
  lql?: LqlEvaluator;
  jobs?: JobRegistry;
}

/** A failed check carries the sentence the UI shows beside the transition. */
export type RuleOutcome = { ok: true } | { ok: false; reason: string };

interface RuleBase<Args> {
  name: string;
  kind: WorkflowRuleKind;
  label: string;
  description: string;
  params: z.ZodType<Args>;
  /** False while the rule depends on a contract nobody has supplied yet. */
  available?: (deps: Pick<RuleContext, 'lql' | 'jobs'>) => boolean;
}

export interface ConditionRule<Args = unknown> extends RuleBase<Args> {
  kind: 'condition';
  check(args: Args, rule: RuleContext): Promise<RuleOutcome>;
}

export interface ValidatorRule<Args = unknown> extends RuleBase<Args> {
  kind: 'validator';
  validate(args: Args, rule: RuleContext): Promise<RuleOutcome>;
}

export interface PostActionRule<Args = unknown> extends RuleBase<Args> {
  kind: 'post_action';
  run(args: Args, rule: RuleContext): Promise<void>;
}

export type WorkflowRuleDefinition<Args = unknown> =
  | ConditionRule<Args>
  | ValidatorRule<Args>
  | PostActionRule<Args>;

/** The person a post-action is recorded against; system actors leave it null. */
export function actorUserId(rule: RuleContext): string | null {
  const { actor } = rule.ctx;
  return actor.kind === 'user' ? actor.id : (actor.userId ?? null);
}

export const pass: RuleOutcome = { ok: true };
export const fail = (reason: string): RuleOutcome => ({ ok: false, reason });

/** True when a field carries a value a person would call "set". */
export function isSet(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** The submitted value wins over the stored one, so a form can set a field in the same move. */
export function fieldValue(rule: RuleContext, key: string): unknown {
  if (key in rule.submitted) return rule.submitted[key];
  if (key in rule.issue) return rule.issue[key as keyof WorkflowIssue];
  return rule.issue.custom_fields[key];
}
