import {
  createIssueFieldCatalog,
  parseLql,
  validateLql,
  type Expression,
  type LqlError,
  type Value,
} from '@bemmoly/shared';
import type { MockIssue } from '../seed/work-board.ts';

/*
 * LQL over the mock's issues: the shared parser and validator, then a small evaluator for the
 * fields the board's filters use. The server compiles the same tree to SQL; this answers the
 * same questions in memory so the filter bar and quick filters can be exercised.
 */

export interface LqlContext {
  meId: string | null;
  statusName(id: string): string;
  statusCategory(id: string): string;
  typeName(id: string): string;
  userName(id: string | null): string | null;
  labelName(id: string): string;
  issueKey(id: string | null): string | null;
  sprintName(id: string | null): string | null;
}

const catalog = createIssueFieldCatalog();
const HOUR = 3_600_000;
const UNIT = { h: HOUR, d: 24 * HOUR, w: 7 * 24 * HOUR } as const;

function literal(value: Value, ctx: LqlContext): string | number | null {
  switch (value.kind) {
    case 'string':
      return value.value.toLowerCase();
    case 'number':
      return value.value;
    case 'date':
      return Date.parse(value.value);
    case 'duration':
      return Date.now() + value.amount * UNIT[value.unit];
    case 'me':
      return ctx.userName(ctx.meId)?.toLowerCase() ?? null;
    case 'function':
      return value.name === 'now' ? Date.now() : null;
  }
}

/** The issue's values for a field, lowercased for comparison; dates as epoch milliseconds. */
function valuesOf(field: string, issue: MockIssue, ctx: LqlContext): Array<string | number> {
  const lower = (text: string | null) => (text === null ? [] : [text.toLowerCase()]);
  switch (field) {
    case 'status':
      return lower(ctx.statusName(issue.statusId));
    case 'statusCategory':
      return lower(ctx.statusCategory(issue.statusId));
    case 'type':
      return lower(ctx.typeName(issue.typeId));
    case 'priority':
      return lower(issue.priority);
    case 'assignee':
      return lower(ctx.userName(issue.assigneeId));
    case 'label':
      return issue.labelIds.map((id) => ctx.labelName(id).toLowerCase());
    case 'key':
      return lower(issue.key);
    case 'epic':
    case 'parent':
      return lower(ctx.issueKey(issue.parentId));
    case 'sprint':
      return lower(ctx.sprintName(issue.sprintId));
    case 'estimate':
      return issue.estimate === null ? [] : [issue.estimate];
    case 'due':
      return issue.dueAt ? [Date.parse(issue.dueAt)] : [];
    case 'updated':
      return [Date.parse(issue.updatedAt)];
    case 'text':
      return lower(issue.title);
    default:
      return [];
  }
}

function compare(actual: string | number, operator: string, expected: string | number | null) {
  if (expected === null) return false;
  switch (operator) {
    case '=':
      return actual === expected;
    case '!=':
      return actual !== expected;
    case '~':
      return String(actual).includes(String(expected));
    case '!~':
      return !String(actual).includes(String(expected));
    case '<':
      return actual < expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    default:
      return actual >= expected;
  }
}

function test(expression: Expression, issue: MockIssue, ctx: LqlContext): boolean {
  switch (expression.kind) {
    case 'and':
      return expression.operands.every((operand) => test(operand, issue, ctx));
    case 'or':
      return expression.operands.some((operand) => test(operand, issue, ctx));
    case 'not':
      return !test(expression.operand, issue, ctx);
    case 'empty': {
      const empty = valuesOf(fieldKey(expression.field.name), issue, ctx).length === 0;
      return expression.negated ? !empty : empty;
    }
    case 'membership': {
      const actual = valuesOf(fieldKey(expression.field.name), issue, ctx);
      const wanted = expression.values.map((value) => literal(value, ctx));
      const hit = actual.some((value) => wanted.includes(value));
      return expression.operator === 'IN' ? hit : !hit;
    }
    case 'comparison': {
      const actual = valuesOf(fieldKey(expression.field.name), issue, ctx);
      const expected = literal(expression.value, ctx);
      if (expression.operator === '!=' || expression.operator === '!~')
        return actual.every((value) => compare(value, expression.operator, expected));
      return actual.some((value) => compare(value, expression.operator, expected));
    }
  }
}

const fieldKey = (name: string) => catalog.resolve(name)?.key ?? name;

/** A predicate for the query, or the first problem in it, as the server would answer 400. */
export function compileLql(
  text: string,
  ctx: LqlContext,
): { ok: true; test: (issue: MockIssue) => boolean } | { ok: false; error: LqlError } {
  const parsed = parseLql(text);
  if (!parsed.ok) return parsed;
  const problem = validateLql(parsed.value, catalog)[0];
  if (problem) return { ok: false, error: problem };
  const where = parsed.value.where;
  return { ok: true, test: (issue) => (where ? test(where, issue, ctx) : true) };
}
