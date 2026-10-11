import { parseLql, ValidationError } from '@bemmoly/shared';
import type { z } from 'zod';
import type { AutomationAction, AutomationTrigger } from '../../../../shared/index.ts';
import { findAction } from './actions/index.ts';
import { findTrigger, SCHEDULED_TRIGGERS } from './triggers/index.ts';

interface Issue {
  path: string;
  message: string;
}

function argIssues(schema: z.ZodType, args: unknown, prefix: string): Issue[] {
  const parsed = schema.safeParse(args ?? {});
  if (parsed.success) return [];
  const byPath = new Map<string, string>();
  for (const issue of parsed.error.issues) {
    const path = [prefix, ...issue.path.map(String)].join('.');
    if (!byPath.has(path)) byPath.set(path, issue.message);
  }
  return [...byPath].map(([path, message]) => ({ path, message }));
}

export interface RuleShape {
  trigger: AutomationTrigger;
  conditions: readonly string[];
  actions: readonly AutomationAction[];
}

/**
 * Checks a rule against the registries: the trigger and every action must exist and their
 * arguments must parse, every condition must be LQL, and a scheduled rule needs a condition.
 * Every problem is reported at once, each under the path the builder shows it at.
 */
export function assertValidRule(rule: RuleShape): void {
  const issues: Issue[] = [];
  const trigger = findTrigger(rule.trigger.name);
  if (!trigger) {
    issues.push({ path: 'trigger.name', message: `There is no trigger "${rule.trigger.name}"` });
  } else {
    issues.push(...argIssues(trigger.params, rule.trigger.args, 'trigger.args'));
  }
  rule.conditions.forEach((query, index) => {
    const parsed = parseLql(query);
    if (!parsed.ok) {
      const message = parsed.error.message || 'The query does not parse';
      issues.push({ path: `conditions.${index}`, message });
    }
  });
  if (trigger && SCHEDULED_TRIGGERS.includes(trigger.name) && rule.conditions.length === 0) {
    issues.push({
      path: 'conditions',
      message: 'A scheduled rule needs a filter, or it would act on every issue',
    });
  }
  rule.actions.forEach((entry, index) => {
    const action = findAction(entry.name);
    if (!action) {
      issues.push({ path: `actions.${index}.name`, message: `There is no action "${entry.name}"` });
      return;
    }
    issues.push(...argIssues(action.params, entry.args, `actions.${index}.args`));
  });
  if (issues.length > 0) {
    throw new ValidationError(issues[0]!.message, { details: { issues } });
  }
}
