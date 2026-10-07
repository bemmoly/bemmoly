import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type postgres from 'postgres';
import type { Connection } from './store.ts';

const dialect = new PgDialect();

export interface RenderedQuery {
  sql: string;
  params: unknown[];
}

export function render(statement: SQL): RenderedQuery {
  const query = dialect.sqlToQuery(statement);
  return { sql: query.sql, params: query.params };
}

/** The text `db plan` prints: the statement, then its parameters when it has any. */
export function formatForPlan(statement: SQL): string {
  const { sql, params } = render(statement);
  const text = sql
    .trim()
    .split('\n')
    .map((line) => line.replace(/^ {6}/, ''))
    .join('\n');
  const suffix = params.length > 0 ? `\n-- params: ${JSON.stringify(params)}` : '';
  return `${text};${suffix}`;
}

export async function run<Row extends Record<string, unknown>>(
  connection: Connection,
  statement: SQL,
): Promise<Row[]> {
  const { sql, params } = render(statement);
  const rows = await connection.unsafe(sql, params as postgres.ParameterOrJSON<never>[]);
  return [...rows] as unknown as Row[];
}

const IDENTIFIER = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

/** A table name a changeset passes as a string, quoted; anything unusual is refused. */
export function quoteTable(table: string): string {
  if (!IDENTIFIER.test(table)) {
    throw new TypeError(`"${table}" is not a plain table name (lowercase, optional schema.)`);
  }
  return table
    .split('.')
    .map((part) => `"${part}"`)
    .join('.');
}
