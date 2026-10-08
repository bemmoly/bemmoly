import type { SqlClient, SqlFragment } from '@bemmoly/core';
import { ValidationError, type LqlOperator, type Value } from '@bemmoly/shared';
import { dateOf, isWholeDay, likePattern, numberOf, textOf, type ValueContext } from './values.ts';

/*
 * The building blocks every field compiles through. Each takes the column
 * expression as a fragment and the operator the validator already accepted,
 * and returns the predicate with every value as a parameter. The operator
 * itself is spelled in the template, never interpolated.
 */

/** Turns the values people typed into the subquery selecting the ids they name. */
export type Lookup = (sql: SqlClient, values: Value[], cx: ValueContext) => SqlFragment;

const unsupported = (operator: LqlOperator) =>
  new ValidationError(`${operator} is not supported here`, { code: 'bad_request' });

/** `col op value` for the six ordering operators; the caller binds the value. */
export function compare(
  sql: SqlClient,
  column: SqlFragment,
  operator: LqlOperator,
  value: SqlFragment,
): SqlFragment {
  switch (operator) {
    case '=':
      return sql`${column} = ${value}`;
    case '!=':
      return sql`${column} is distinct from ${value}`;
    case '<':
      return sql`${column} < ${value}`;
    case '<=':
      return sql`${column} <= ${value}`;
    case '>':
      return sql`${column} > ${value}`;
    case '>=':
      return sql`${column} >= ${value}`;
    default:
      throw unsupported(operator);
  }
}

/** Emptiness on a nullable column, shared by every field that has one. */
export function emptiness(sql: SqlClient, column: SqlFragment, negated: boolean): SqlFragment {
  return negated ? sql`${column} is not null` : sql`${column} is null`;
}

export function numberPredicate(
  sql: SqlClient,
  column: SqlFragment,
  operator: LqlOperator,
  values: Value[],
): SqlFragment {
  const numbers = values.map(numberOf);
  switch (operator) {
    case 'IN':
      return sql`${column} = any(${numbers}::numeric[])`;
    case 'NOT IN':
      return sql`${column} <> all(${numbers}::numeric[])`;
    case 'IS EMPTY':
    case 'IS NOT EMPTY':
      return emptiness(sql, column, operator === 'IS NOT EMPTY');
    default:
      return compare(sql, column, operator, sql`${numbers[0] ?? null}::numeric`);
  }
}

/**
 * A whole-day literal with `=` means "on that day", so the comparison happens
 * on the date; every other case compares instants.
 */
export function datePredicate(
  sql: SqlClient,
  column: SqlFragment,
  operator: LqlOperator,
  values: Value[],
  cx: ValueContext,
): SqlFragment {
  if (operator === 'IS EMPTY' || operator === 'IS NOT EMPTY') {
    return emptiness(sql, column, operator === 'IS NOT EMPTY');
  }
  const [value] = values;
  if (!value) throw unsupported(operator);
  const instant = dateOf(value, cx);
  if ((operator === '=' || operator === '!=') && isWholeDay(value)) {
    return compare(sql, sql`(${column})::date`, operator, sql`(${instant}::timestamptz)::date`);
  }
  return compare(sql, column, operator, sql`${instant}::timestamptz`);
}

export function textPredicate(
  sql: SqlClient,
  column: SqlFragment,
  operator: LqlOperator,
  values: Value[],
): SqlFragment {
  const text = values[0] ? textOf(values[0]) : '';
  switch (operator) {
    case '~':
      return sql`${column} ilike ${likePattern(text)}`;
    case '!~':
      return sql`${column} not ilike ${likePattern(text)}`;
    case '=':
      return sql`lower(${column}) = lower(${text})`;
    case '!=':
      return sql`lower(${column}) is distinct from lower(${text})`;
    case 'IN':
      return sql`lower(${column}) = any(${values.map((v) => textOf(v).toLowerCase())}::text[])`;
    case 'NOT IN':
      return sql`lower(${column}) <> all(${values.map((v) => textOf(v).toLowerCase())}::text[])`;
    case 'IS EMPTY':
      return sql`coalesce(${column}, '') = ''`;
    case 'IS NOT EMPTY':
      return sql`coalesce(${column}, '') <> ''`;
    default:
      throw unsupported(operator);
  }
}

/**
 * A reference column (status, type, sprint...) compared by the names people
 * type; `lookup` turns the names into the id subquery. `!=` and `NOT IN` keep
 * a null reference out, as people expect from "status != Done".
 */
export function lookupPredicate(
  sql: SqlClient,
  column: SqlFragment,
  operator: LqlOperator,
  values: Value[],
  cx: ValueContext,
  lookup: Lookup,
): SqlFragment {
  if (operator === 'IS EMPTY' || operator === 'IS NOT EMPTY') {
    return emptiness(sql, column, operator === 'IS NOT EMPTY');
  }
  const ids = lookup(sql, values, cx);
  switch (operator) {
    case '=':
    case 'IN':
      return sql`${column} in (${ids})`;
    case '!=':
    case 'NOT IN':
      return sql`${column} not in (${ids})`;
    default:
      throw unsupported(operator);
  }
}

/** Membership in a many-to-many side table, expressed as existence of a row. */
export function existsPredicate(
  sql: SqlClient,
  operator: LqlOperator,
  matching: SqlFragment,
  any: SqlFragment,
): SqlFragment {
  switch (operator) {
    case '=':
    case 'IN':
      return sql`exists (${matching})`;
    case '!=':
    case 'NOT IN':
      return sql`not exists (${matching})`;
    case 'IS EMPTY':
      return sql`not exists (${any})`;
    case 'IS NOT EMPTY':
      return sql`exists (${any})`;
    default:
      throw unsupported(operator);
  }
}
