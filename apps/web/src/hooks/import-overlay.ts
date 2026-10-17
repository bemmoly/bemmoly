import {
  applySelection,
  type ImportContainerRow,
  type ImportSelectionOp,
  type ImportSelectionScope,
  type ImportSelectionSummary,
} from '@bemmoly/shared';

/** A selection operation and its place in the order the server applies them. */
export interface SeqOp {
  seq: number;
  op: ImportSelectionOp;
}

/** A listed row and the last operation the server had applied when it was read. */
export type ListedRow = ImportContainerRow & { seq: number };

/** Ticks the last clear removed, by row, so a restore shows at once. */
export type BeforeClear = ReadonlyMap<string, boolean>;

const after = (ops: readonly SeqOp[], from: number, upTo = Infinity) =>
  ops.filter((entry) => entry.seq > from && entry.seq <= upTo).map((entry) => entry.op);

/** A row's tick now: as read, then every operation the server had not applied yet. */
export function tickOf(row: ListedRow, ops: readonly SeqOp[], before: BeforeClear): boolean {
  return applySelection(row, after(ops, row.seq), before.get(row.id));
}

/** The rows as they should look now, ticks replayed. */
export function overlayRows(
  rows: readonly ListedRow[],
  ops: readonly SeqOp[],
  before: BeforeClear,
): ListedRow[] {
  const pending = ops.some((entry) => rows.some((row) => entry.seq > row.seq));
  if (!pending) return [...rows];
  return rows.map((row) => ({ ...row, selected: tickOf(row, ops, before) }));
}

const sameScope = (a: ImportSelectionScope, b: ImportSelectionScope) =>
  (a.q ?? '') === (b.q ?? '') && a.filter === b.filter;

/**
 * How many rows in this search and filter are ticked now. The server's number holds for the
 * moment the first page was read; each later operation moves it: a clear or a tick-all of
 * this same view sets it outright, the rest add what they changed among the loaded rows.
 */
export function viewSelected(
  rows: readonly ListedRow[],
  ops: readonly SeqOp[],
  before: BeforeClear,
  server: { selected: number; selectable: number; seq: number },
  scope: ImportSelectionScope,
): number {
  let selected = server.selected;
  const later = ops.filter((entry) => entry.seq > server.seq);
  const ticks = new Map(rows.map((row) => [row.id, row.selected]));
  for (const entry of later) {
    const { op } = entry;
    if ('clear' in op) selected = 0;
    else if ('scope' in op && sameScope(op.scope, scope)) {
      selected = op.select ? server.selectable : 0;
    }
    for (const row of rows) {
      if (row.seq >= entry.seq) continue;
      const was = ticks.get(row.id) ?? false;
      const now = applySelection({ ...row, selected: was }, [op], before.get(row.id));
      ticks.set(row.id, now);
      const wide = 'clear' in op || ('scope' in op && sameScope(op.scope, scope));
      if (!wide && now !== was) selected += now ? 1 : -1;
    }
  }
  return Math.max(0, Math.min(server.selectable, selected));
}

/**
 * The running total now: the server's last answer, moved by what later operations changed
 * among the loaded rows. Rows not loaded catch up when the server answers.
 */
export function summaryNow(
  rows: readonly ListedRow[],
  ops: readonly SeqOp[],
  before: BeforeClear,
  server: ImportSelectionSummary,
  serverSeq: number,
): ImportSelectionSummary {
  const total = { ...server };
  if (!ops.some((entry) => entry.seq > serverSeq)) return total;
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id) || row.access === 'none') continue;
    seen.add(row.id);
    const base = { ...row, seq: Math.min(row.seq, serverSeq) };
    const then = applySelection(base, after(ops, base.seq, serverSeq), before.get(row.id));
    const now = tickOf(row, ops, before);
    if (then === now) continue;
    const sign = now ? 1 : -1;
    total.selected += sign;
    if (row.count === null) total.uncounted += sign;
    else total.records += sign * row.count;
  }
  return {
    selected: Math.max(0, total.selected),
    records: Math.max(0, total.records),
    uncounted: Math.max(0, total.uncounted),
  };
}
