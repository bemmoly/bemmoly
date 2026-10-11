import type { SqlClient } from '../../../clients/postgres.ts';

/*
 * The set of records whose embeddings are out of date, read and written only here. A change
 * marks its records (a repeat change bumps the revision), and one drain job per source takes
 * the oldest marks, indexes them and clears exactly the revisions it saw.
 */

export interface PendingMark {
  targetId: string;
  revision: number;
}

/** Marks these records as changed; every replica hears the change, so this is idempotent. */
export async function markPending(
  sql: SqlClient,
  kind: string,
  ids: readonly string[],
): Promise<void> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return;
  await sql`
    insert into pending_embeddings (target_kind, target_id)
    select ${kind}, id from unnest(${unique}::text[]) as id
    on conflict (target_kind, target_id)
    do update set revision = pending_embeddings.revision + 1`;
}

/** The oldest marks of a source, without removing them. */
export async function peekPending(
  sql: SqlClient,
  kind: string,
  limit: number,
): Promise<PendingMark[]> {
  const rows = await sql<{ target_id: string; revision: number }[]>`
    select target_id, revision from pending_embeddings
    where target_kind = ${kind} order by id limit ${limit}`;
  return rows.map((row) => ({ targetId: row.target_id, revision: row.revision }));
}

/** Clears the marks that were indexed; one changed since keeps its row for the next drain. */
export async function settlePending(
  sql: SqlClient,
  kind: string,
  marks: readonly PendingMark[],
): Promise<void> {
  if (marks.length === 0) return;
  await sql`
    delete from pending_embeddings p
    using unnest(${marks.map((mark) => mark.targetId)}::text[],
                 ${marks.map((mark) => mark.revision)}::integer[]) as done(target_id, revision)
    where p.target_kind = ${kind} and p.target_id = done.target_id
      and p.revision = done.revision`;
}

/** Whether a source still has marks waiting. */
export async function hasPending(sql: SqlClient, kind: string): Promise<boolean> {
  const [row] = await sql<{ waiting: boolean }[]>`
    select exists(select 1 from pending_embeddings where target_kind = ${kind}) as waiting`;
  return row?.waiting ?? false;
}

/** The sources with marks waiting, for the safety net that restarts their drains. */
export async function pendingKinds(sql: SqlClient): Promise<string[]> {
  const rows = await sql<{ target_kind: string }[]>`
    select distinct target_kind from pending_embeddings order by target_kind`;
  return rows.map((row) => row.target_kind);
}
