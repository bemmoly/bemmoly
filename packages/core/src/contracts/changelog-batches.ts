import { sql, type SQL } from 'drizzle-orm';
import type { ChangesetContext } from './changelog.ts';

const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
const TABLE_NAME = /^[a-z][a-z0-9_]*$/;

/** A text column as a uuid, or null when it does not hold one, without a cast error. */
export const textAsUuid = (column: SQL): SQL =>
  sql`(CASE WHEN ${column} ~* ${UUID_PATTERN} THEN ${column}::uuid END)`;

interface Batch extends Record<string, unknown> {
  removed: number;
  last: string | null;
}

/**
 * Deletes the rows of `table` (aliased `t`) matching `where`, walking the uuid primary key
 * in batches. In a changeset with `transactional: false` each batch commits on its own, so
 * a large cleanup never holds one long lock and a rerun after a crash picks up what is left.
 * Returns how many rows went.
 */
export async function deleteInBatches(
  ctx: ChangesetContext,
  table: string,
  where: SQL,
  batch = 5000,
): Promise<number> {
  if (!TABLE_NAME.test(table)) throw new Error(`Not a table: ${table}`);
  let total = 0;
  let after = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const [row] = await ctx.query<Batch>(sql`
      WITH doomed AS (
        SELECT t.id FROM ${sql.identifier(table)} t
        WHERE t.id > ${after}::uuid AND ${where}
        ORDER BY t.id LIMIT ${batch}
      ), gone AS (
        DELETE FROM ${sql.identifier(table)} WHERE id IN (SELECT id FROM doomed) RETURNING id
      )
      SELECT count(*)::int AS removed, max(id::text) AS last FROM gone`);
    const removed = row?.removed ?? 0;
    total += removed;
    if (removed < batch || !row?.last) break;
    after = row.last;
  }
  if (total > 0) ctx.log(`removed ${total} rows from ${table}`);
  return total;
}
