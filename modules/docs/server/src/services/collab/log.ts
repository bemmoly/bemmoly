import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { applyUpdate, Doc, encodeStateAsUpdate, mergeUpdates } from 'yjs';

/*
 * A page's Yjs document on disk: page_state holds the compacted document and the last seq
 * folded into it; page_updates holds every update after that, in seq order. Appends and
 * compaction take one advisory lock per page, so seq never repeats and compaction never
 * folds a row that is still being written.
 */

export interface PageLog {
  state: Uint8Array | null;
  foldedSeq: number;
  updates: { seq: number; update: Uint8Array }[];
}

const bytes = (value: Uint8Array) =>
  new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

async function lockLog(tx: SqlExecutor, pageId: string): Promise<void> {
  await tx`select pg_advisory_xact_lock(hashtextextended(${`docs.page_log:${pageId}`}, 0))`;
}

export async function readLog(sql: SqlExecutor, pageId: string): Promise<PageLog> {
  const [state] = await sql<{ state: Uint8Array; folded_seq: string }[]>`
    select state, folded_seq from page_state where page_id = ${pageId}`;
  const foldedSeq = Number(state?.folded_seq ?? 0);
  const updates = await sql<{ seq: string; update: Uint8Array }[]>`
    select seq, update from page_updates
    where page_id = ${pageId} and seq > ${foldedSeq}
    order by seq`;
  return {
    state: state ? bytes(state.state) : null,
    foldedSeq,
    updates: updates.map((row) => ({ seq: Number(row.seq), update: bytes(row.update) })),
  };
}

/** The whole document as one update, or null when nothing was ever stored. */
export function mergeLog(log: PageLog): Uint8Array | null {
  const parts = [...(log.state ? [log.state] : []), ...log.updates.map((row) => row.update)];
  if (parts.length === 0) return null;
  return parts.length === 1 ? parts[0]! : mergeUpdates(parts);
}

/** The last seq written and how many updates sit past page_state. */
export async function logLength(
  sql: SqlExecutor,
  pageId: string,
): Promise<{ seq: number; unfolded: number }> {
  const [last] = await sql<{ max_seq: string; folded_seq: string }[]>`
    select
      coalesce((select max(seq) from page_updates where page_id = ${pageId}), 0) as max_seq,
      coalesce((select folded_seq from page_state where page_id = ${pageId}), 0) as folded_seq`;
  const foldedSeq = Number(last?.folded_seq ?? 0);
  const seq = Math.max(Number(last?.max_seq ?? 0), foldedSeq);
  return { seq, unfolded: seq - foldedSeq };
}

/** Appends one update after the last and returns its seq. */
export async function appendUpdate(
  sql: SqlClient,
  pageId: string,
  update: Uint8Array,
  userId: string | null,
): Promise<number> {
  return sql.begin(async (tx) => {
    await lockLog(tx, pageId);
    const seq = (await logLength(tx, pageId)).seq + 1;
    await tx`
      insert into page_updates (page_id, seq, update, user_id)
      values (${pageId}, ${seq}, ${Buffer.from(update)}, ${userId}::uuid)`;
    return seq;
  });
}

/**
 * Writes the first state of a page that has none yet (a template, a seed or an import
 * converted from its snapshot). A page that gained state meanwhile keeps it.
 */
export async function seedState(sql: SqlClient, pageId: string, state: Uint8Array) {
  await sql.begin(async (tx) => {
    await lockLog(tx, pageId);
    await tx`
      insert into page_state (page_id, state, folded_seq)
      values (${pageId}, ${Buffer.from(state)}, 0)
      on conflict (page_id) do nothing`;
  });
}

/**
 * Folds every update into page_state and deletes the folded rows, in one transaction. The
 * result goes through a Y.Doc so deleted content is garbage-collected, not just concatenated.
 */
export async function compactLog(sql: SqlClient, pageId: string): Promise<{ folded: number }> {
  return sql.begin(async (tx) => {
    await lockLog(tx, pageId);
    const log = await readLog(tx, pageId);
    const lastSeq = log.updates.at(-1)?.seq;
    const merged = mergeLog(log);
    if (lastSeq === undefined || !merged) return { folded: 0 };
    const doc = new Doc();
    applyUpdate(doc, merged);
    const state = Buffer.from(encodeStateAsUpdate(doc));
    doc.destroy();
    await tx`
      insert into page_state (page_id, state, folded_seq)
      values (${pageId}, ${state}, ${lastSeq})
      on conflict (page_id) do update
        set state = excluded.state, folded_seq = excluded.folded_seq, updated_at = now()`;
    await tx`delete from page_updates where page_id = ${pageId} and seq <= ${lastSeq}`;
    return { folded: log.updates.length };
  });
}
