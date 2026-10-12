import {
  matchesScope,
  type ImportContainerFilter,
  type ImportClashRule,
  type ImportContainerRow,
  type ImportJob,
  type ImportPersonRow,
  type ImportSelectionOp,
  type ImportSelectionSummary,
  type ImportTarget,
  type ImportTargetRequest,
} from '@bemmoly/shared';
import type { MockDb } from '../db.ts';
import { defaultSelection, type MockContainer } from '../seed/import-containers.ts';

/** One job's chooser as the server keeps it: the rows found, the ticks, what a clear removed. */
export interface ChooserState {
  rows: MockContainer[];
  selected: Set<string>;
  /** Rows counted on request (a big site's are not counted until then). */
  counted: Set<string>;
  /** What the last clear unticked, for restore. */
  cleared: Set<string> | null;
  /** Where the admin asked each container to go, kept across plans. */
  requests: Map<string, ImportTargetRequest>;
  /** Where the last plan sent each chosen container; null before a plan. */
  targets: Map<string, ImportTarget> | null;
  onClash: ImportClashRule;
  /** Everyone the chosen containers name, once planned. */
  people: ImportPersonRow[] | null;
}

const jobs = new WeakMap<MockDb, ImportJob[]>();
const choosers = new Map<string, ChooserState>();

export const listOf = (db: MockDb) => {
  const found = jobs.get(db);
  if (found) return found;
  const fresh: ImportJob[] = [];
  jobs.set(db, fresh);
  return fresh;
};

export const findJob = (db: MockDb, id: string | undefined) =>
  listOf(db).find((job) => job.id === id);

export function startChooser(jobId: string, rows: MockContainer[]) {
  choosers.set(jobId, {
    rows,
    selected: defaultSelection(rows),
    counted: new Set(),
    cleared: null,
    requests: new Map(),
    targets: null,
    onClash: 'error',
    people: null,
  });
}

export const chooserOf = (jobId: string | undefined) => (jobId ? choosers.get(jobId) : undefined);

export function rowOf(state: ChooserState, row: MockContainer): ImportContainerRow {
  const { records, lazy, ...rest } = row;
  return {
    ...rest,
    count: row.access === 'none' ? 0 : !lazy || state.counted.has(row.id) ? records : null,
    selected: state.selected.has(row.id),
    target: state.targets?.get(row.id) ?? null,
  };
}

export function matching(
  state: ChooserState,
  q: string | undefined,
  filter: ImportContainerFilter,
) {
  return state.rows.filter((row) => matchesScope(rowOf(state, row), { q, filter }));
}

/** Applies the operations in order, as the server's selection service does. */
export function applyOps(state: ChooserState, ops: readonly ImportSelectionOp[]) {
  const selectable = (row: MockContainer) => row.access === 'ok';
  for (const op of ops) {
    if ('clear' in op) {
      state.cleared = new Set(state.selected);
      state.selected.clear();
    } else if ('restore' in op) {
      for (const id of state.cleared ?? []) state.selected.add(id);
      state.cleared = null;
    } else if ('ids' in op) {
      for (const row of state.rows) {
        if (!op.ids.includes(row.id) || !selectable(row)) continue;
        if (op.select) state.selected.add(row.id);
        else state.selected.delete(row.id);
      }
    } else {
      for (const row of matching(state, op.scope.q, op.scope.filter)) {
        if (!selectable(row)) continue;
        if (op.select) state.selected.add(row.id);
        else state.selected.delete(row.id);
      }
    }
  }
}

export function summaryOf(state: ChooserState): ImportSelectionSummary {
  let records = 0;
  let uncounted = 0;
  for (const row of state.rows) {
    if (!state.selected.has(row.id)) continue;
    const count = rowOf(state, row).count;
    if (count === null) uncounted += 1;
    else records += count;
  }
  return { selected: state.selected.size, records, uncounted };
}
