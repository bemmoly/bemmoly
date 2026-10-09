import type { SqlClient, SqlFragment } from '@bemmoly/core';
import { ValidationError, type DurationUnit, type Value } from '@bemmoly/shared';

/** What a compiled value needs besides the parser's node. */
export interface ValueContext {
  sql: SqlClient;
  /** The person behind the actor, bound for `me`; null for system actors. */
  actorUserId: string | null;
  /** Injected so relative dates are reproducible in tests. */
  now: Date;
}

const UNIT_MS: Record<DurationUnit, number> = {
  h: 3_600_000,
  d: 86_400_000,
  w: 7 * 86_400_000,
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const bad = (message: string) => new ValidationError(message, { code: 'bad_request' });

/** Date functions resolve in UTC on the server; the filter bar shows the same instant in local time. */
export function dateFunction(name: string, now: Date): Date {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7;
  switch (name) {
    case 'now':
      return now;
    case 'startOfDay':
      return day;
    case 'endOfDay':
      return new Date(day.getTime() + UNIT_MS.d - 1);
    case 'startOfWeek':
      return new Date(day.getTime() - weekday * UNIT_MS.d);
    case 'endOfWeek':
      return new Date(day.getTime() + (7 - weekday) * UNIT_MS.d - 1);
    case 'startOfMonth':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case 'endOfMonth':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 1);
    default:
      throw bad(`${name}() is not a date function`);
  }
}

/** True for a literal that names a whole day, which `=` then matches as a range. */
export function isWholeDay(value: Value): boolean {
  return (value.kind === 'date' || value.kind === 'string') && DATE_ONLY.test(value.value.trim());
}

/** A date value as an ISO instant, bound as text and cast on the SQL side. */
export function dateOf(value: Value, cx: ValueContext): string {
  switch (value.kind) {
    case 'date':
    case 'string': {
      const parsed = Date.parse(value.value);
      if (Number.isNaN(parsed)) throw bad(`"${value.value}" is not a date`);
      return new Date(parsed).toISOString();
    }
    case 'duration':
      return new Date(cx.now.getTime() + value.amount * UNIT_MS[value.unit]).toISOString();
    case 'function':
      return dateFunction(value.name, cx.now).toISOString();
    default:
      throw bad('A date was expected here');
  }
}

export function textOf(value: Value): string {
  switch (value.kind) {
    case 'string':
    case 'date':
      return value.value;
    case 'number':
      return String(value.value);
    default:
      throw bad('A name was expected here');
  }
}

export function numberOf(value: Value): number {
  if (value.kind !== 'number') throw bad('A number was expected here');
  return value.value;
}

/** The actor's user id for `me`; a system actor has nobody to be. */
export function meOf(cx: ValueContext): string {
  if (!cx.actorUserId) throw bad('"me" has no meaning for a system actor');
  return cx.actorUserId;
}

/** `%` and `_` in a search term are literal characters to the person typing it. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Joins fragments with a keyword, wrapping the result so precedence is explicit. */
export function joinWith(sql: SqlClient, parts: SqlFragment[], keyword: 'and' | 'or'): SqlFragment {
  const [first, ...rest] = parts;
  if (!first) return sql`true`;
  const joined = rest.reduce(
    (acc, part) => (keyword === 'and' ? sql`${acc} and ${part}` : sql`${acc} or ${part}`),
    first,
  );
  return sql`(${joined})`;
}
