import type { ImportSelectionOp, ImportSelectionSummary } from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { scopeWhere } from './containers.ts';

/*
 * The selection on import_containers: operations applied in order, the running total, the
 * plan body's exact list, and the first ticks on a fresh connection.
 */

/** Applies selection operations in order, inside the caller's transaction. */
export async function applySelectionOps(
  tx: SqlExecutor,
  jobId: string,
  ops: readonly ImportSelectionOp[],
): Promise<void> {
  for (const op of ops) {
    if ('clear' in op) {
      await tx`
        update import_containers set selected_before = selected, selected = false
        where job_id = ${jobId}`;
    } else if ('restore' in op) {
      await tx`
        update import_containers set selected = coalesce(selected_before, selected)
        where job_id = ${jobId} and access = 'ok'`;
    } else if ('ids' in op) {
      await tx`
        update import_containers set selected = ${op.select}
        where job_id = ${jobId} and access = 'ok'
          and source_id = any(${op.ids as string[]}::text[])`;
    } else {
      await tx`
        update import_containers set selected = ${op.select}
        where job_id = ${jobId} and access = 'ok' ${scopeWhere(tx, op.scope)}`;
    }
  }
}

export async function selectionSummary(
  sql: SqlExecutor,
  jobId: string,
): Promise<ImportSelectionSummary> {
  const [row] = await sql<ImportSelectionSummary[]>`
    select count(*)::int as selected, coalesce(sum(count), 0)::int as records,
      count(*) filter (where count is null)::int as uncounted
    from import_containers where job_id = ${jobId} and selected`;
  return row ?? { selected: 0, records: 0, uncounted: 0 };
}

/** Exactly these ids ticked (those the token can read), nothing else; returns ids not found. */
export async function selectExactly(
  tx: SqlExecutor,
  jobId: string,
  ids: readonly string[],
): Promise<string[]> {
  await tx`update import_containers set selected = false where job_id = ${jobId}`;
  await tx`
    update import_containers set selected = true
    where job_id = ${jobId} and access = 'ok' and source_id = any(${ids as string[]}::text[])`;
  const rows = await tx<{ source_id: string }[]>`
    select source_id from import_containers
    where job_id = ${jobId} and source_id = any(${ids as string[]}::text[])`;
  const found = new Set(rows.map((row) => row.source_id));
  return ids.filter((id) => !found.has(id));
}

/**
 * The first ticks on a fresh connection: on a small site (under 50) the new ones with
 * something in them; on a big site nothing, so nobody starts a multi-hour run by accident.
 */
export async function preselect(sql: SqlExecutor, jobId: string, total: number): Promise<void> {
  if (total >= SMALL_SITE) return;
  await sql`
    update import_containers set selected = true
    where job_id = ${jobId} and access = 'ok' and imported_target_id is null
      and (count is null or count > 0)`;
}

/** Below this many containers, counts load at connect time and new ones start ticked. */
export const SMALL_SITE = 50;
