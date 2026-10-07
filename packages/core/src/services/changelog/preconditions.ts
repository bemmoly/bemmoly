import { sql, type SQL } from 'drizzle-orm';
import type { Precondition, PreconditionCheck } from '../../contracts/changelog.ts';
import { quoteTable, run } from './render.ts';
import type { Connection } from './store.ts';

function splitTable(table: string): { schema: string | null; name: string } {
  const [first, second] = table.split('.');
  return second === undefined
    ? { schema: null, name: first ?? table }
    : { schema: first ?? null, name: second };
}

async function scalar(connection: Connection, statement: SQL): Promise<unknown> {
  const [row] = await run<Record<string, unknown>>(connection, statement);
  return row ? Object.values(row)[0] : undefined;
}

function sameValue(actual: unknown, expected: string | number | boolean | null): boolean {
  if (expected === null) return actual === null || actual === undefined;
  if (actual === null || actual === undefined) return false;
  return String(actual) === String(expected);
}

function withinCount(count: number, expected: number | { min?: number; max?: number }): boolean {
  if (typeof expected === 'number') return count === expected;
  return count >= (expected.min ?? 0) && count <= (expected.max ?? Number.POSITIVE_INFINITY);
}

/** True when the database matches the check. */
export async function holds(connection: Connection, check: PreconditionCheck): Promise<boolean> {
  if ('not' in check) return !(await holds(connection, check.not));
  if ('tableExists' in check) {
    const value = await scalar(
      connection,
      sql`select to_regclass(${check.tableExists.table}) is not null`,
    );
    return value === true;
  }
  if ('columnExists' in check) {
    const { schema, name } = splitTable(check.columnExists.table);
    const value = await scalar(
      connection,
      sql`select exists (select 1 from information_schema.columns
        where table_schema = coalesce(${schema}::text, current_schema())
          and table_name = ${name} and column_name = ${check.columnExists.column})`,
    );
    return value === true;
  }
  if ('indexExists' in check) {
    const table = check.indexExists.table ?? null;
    const value = await scalar(
      connection,
      sql`select exists (select 1 from pg_indexes
        where indexname = ${check.indexExists.index}
          and (${table}::text is null or tablename = ${table}::text))`,
    );
    return value === true;
  }
  if ('rowCount' in check) {
    const table = sql.raw(quoteTable(check.rowCount.table));
    const where = check.rowCount.where ? sql` where ${check.rowCount.where}` : sql``;
    const value = await scalar(connection, sql`select count(*)::bigint from ${table}${where}`);
    return withinCount(Number(value), check.rowCount.expected);
  }
  return sameValue(await scalar(connection, check.sqlCheck.query), check.sqlCheck.expected);
}

export function describeCheck(check: PreconditionCheck): string {
  if ('not' in check) return `not (${describeCheck(check.not)})`;
  if ('tableExists' in check) return `tableExists ${check.tableExists.table}`;
  if ('columnExists' in check)
    return `columnExists ${check.columnExists.table}.${check.columnExists.column}`;
  if ('indexExists' in check) return `indexExists ${check.indexExists.index}`;
  if ('rowCount' in check) return `rowCount ${check.rowCount.table}`;
  return 'sqlCheck';
}

/** The first precondition that does not hold, or undefined when all do. */
export async function firstFailing(
  connection: Connection,
  preconditions: readonly Precondition[] | undefined,
): Promise<Precondition | undefined> {
  for (const precondition of preconditions ?? []) {
    if (!(await holds(connection, precondition))) return precondition;
  }
  return undefined;
}
