import type { SqlClient } from '@bemmoly/core';

/*
 * Multi-row inserts in batches. Postgres caps a statement at 65,535 parameters, so the batch
 * size follows the column count; a few thousand rows per statement keeps the seed fast.
 */

export type Row = Record<string, unknown>;

function jsonOrValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  const plain =
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Array.isArray(value);
  return plain ? JSON.stringify(value) : value;
}

export async function insertMany(
  sql: SqlClient,
  table: string,
  rows: readonly Row[],
  options: { skipConflicts?: boolean } = {},
) {
  const first = rows[0];
  if (!first) return;
  const columns = Object.keys(first);
  const batch = Math.max(1, Math.min(4000, Math.floor(60_000 / columns.length)));
  for (let start = 0; start < rows.length; start += batch) {
    // The kernel's client binds jsonb and timestamps as text (clients/postgres.ts);
    // Postgres casts both on assignment.
    const chunk = rows.slice(start, start + batch).map((row) => {
      const out: Row = {};
      for (const column of columns) out[column] = jsonOrValue(row[column]);
      return out;
    });
    await sql`insert into ${sql(table)} ${sql(chunk as never, columns)}
      ${options.skipConflicts ? sql`on conflict do nothing` : sql``}`;
  }
}
