import type { SqlExecutor } from '@bemmoly/core';

/*
 * Start over: every Pipelines record on the install goes, so the install is fresh again. Work,
 * Docs, people and settings stay, and nothing is touched in any cloud: only what Bemmoly
 * recorded about it. Two tables stay because the module's own changesets filled them and the
 * code relies on their rows: the access stamp counter and the built-in CI token issuers.
 */

const KEEP = new Set(['pipeline_access_stamps', 'pipeline_ci_issuers']);

/** Every table the module owns, found by its prefix so a new table is never left behind. */
async function moduleTables(sql: SqlExecutor): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select table_name as name from information_schema.tables
    where table_schema = current_schema() and table_type = 'BASE TABLE'
      and (table_name like 'pipeline\\_%' or table_name like 'cloud\\_%')
    order by table_name`;
  return rows.map((row) => row.name).filter((name) => !KEEP.has(name));
}

/** Empties them in one statement; answers how many rows there were. */
export async function startOver(sql: SqlExecutor): Promise<number> {
  const tables = await moduleTables(sql);
  if (tables.length === 0) return 0;
  const counts = await sql<{ count: number }[]>`
    select (${sql.unsafe(
      tables.map((name) => `(select count(*) from "${name}")`).join(' + '),
    )})::int as count`;
  // No CASCADE: if another module's table pointed at one of these, stopping is right.
  await sql.unsafe(`truncate table ${tables.map((name) => `"${name}"`).join(', ')}`);
  return counts[0]?.count ?? 0;
}
