import type { ApprovalCondition, ApprovalFields } from '@bemmoly/shared/approvals';

type Scalar = string | number | boolean | null;

/** Order comparisons hold only between two numbers or two strings (ISO dates sort as text). */
function compare(left: Scalar, right: Scalar): number | null {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'string' && typeof right === 'string') return left.localeCompare(right);
  return null;
}

/**
 * One condition against the request's fields. A missing field fails every operator except
 * `exists` with `value: false`, so a request that lacks `amount` never passes `amount < 100`.
 */
export function holds(condition: ApprovalCondition, fields: ApprovalFields): boolean {
  const present = Object.hasOwn(fields, condition.field) && fields[condition.field] !== null;
  if (condition.op === 'exists') return condition.value === false ? !present : present;
  if (!present) return false;
  const actual = fields[condition.field]!;
  const expected = condition.value;
  if (condition.op === 'in') return Array.isArray(expected) && expected.includes(actual);
  if (Array.isArray(expected) || expected === undefined) return false;
  if (condition.op === 'eq') return actual === expected;
  if (condition.op === 'neq') return actual !== expected;
  const order = compare(actual, expected);
  if (order === null) return false;
  switch (condition.op) {
    case 'gt':
      return order > 0;
    case 'gte':
      return order >= 0;
    case 'lt':
      return order < 0;
    case 'lte':
      return order <= 0;
  }
}

/** Every condition holds; an empty list always does. */
export const allHold = (conditions: readonly ApprovalCondition[], fields: ApprovalFields) =>
  conditions.every((condition) => holds(condition, fields));
