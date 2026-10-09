import type { BoardConfig } from '@bemmoly/module-work/shared';

/*
 * The column mapping of Board settings as pure functions over a board config:
 * add, rename, reorder and remove columns, set WIP limits and move statuses
 * between columns. Every status lives in at most one column; a status in no
 * column stays off the board.
 */

export type Column = BoardConfig['columns'][number];

/** A status of the board's workflow, as the column editor shows it. */
export interface StatusInfo {
  id: string;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  color: string | null;
}

/** The board keeps two columns at least, as the server's schema does. */
export const MIN_COLUMNS = 2;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'column';

/** A column id derived from the name and free in the config. */
export function columnId(config: BoardConfig, name: string): string {
  const taken = new Set(config.columns.map((column) => column.id));
  const base = slug(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const update = (config: BoardConfig, id: string, patch: Partial<Column>): BoardConfig => ({
  ...config,
  columns: config.columns.map((column) => (column.id === id ? { ...column, ...patch } : column)),
});

/** A new empty column before the done column, where the mock adds it. */
export function addColumn(config: BoardConfig, name = 'New column'): BoardConfig {
  const column: Column = {
    id: columnId(config, name),
    name,
    statusIds: [],
    wipLimit: null,
    done: false,
  };
  const doneIndex = config.columns.findIndex((entry) => entry.done);
  const at = doneIndex === -1 ? config.columns.length : doneIndex;
  return {
    ...config,
    columns: [...config.columns.slice(0, at), column, ...config.columns.slice(at)],
  };
}

export const renameColumn = (config: BoardConfig, id: string, name: string): BoardConfig =>
  update(config, id, { name });

/** Reads a WIP limit as typed: a positive whole number, anything else clears it. */
export function parseWip(text: string): number | null {
  const value = Number.parseInt(text.trim(), 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export const setWip = (config: BoardConfig, id: string, text: string): BoardConfig =>
  update(config, id, { wipLimit: parseWip(text) });

/** Drops a column; its statuses become unmapped. The last two columns stay. */
export function removeColumn(config: BoardConfig, id: string): BoardConfig {
  if (config.columns.length <= MIN_COLUMNS) return config;
  return { ...config, columns: config.columns.filter((column) => column.id !== id) };
}

/** Moves the column at `from` to `to`, as a drag between positions does. */
export function moveColumn(config: BoardConfig, from: number, to: number): BoardConfig {
  const columns = [...config.columns];
  const [moved] = columns.splice(from, 1);
  if (!moved || to < 0 || to > columns.length) return config;
  columns.splice(to, 0, moved);
  return { ...config, columns };
}

/** Puts a status in a column, taking it out of any other; null unmaps it. */
export function moveStatus(
  config: BoardConfig,
  statusId: string,
  columnIdTo: string | null,
): BoardConfig {
  return {
    ...config,
    columns: config.columns.map((column) => {
      const without = column.statusIds.filter((id) => id !== statusId);
      return column.id === columnIdTo
        ? { ...column, statusIds: [...without, statusId] }
        : { ...column, statusIds: without };
    }),
  };
}

/** Workflow statuses no column shows, in workflow order. */
export function unmappedStatuses(config: BoardConfig, statuses: readonly StatusInfo[]) {
  const mapped = new Set(config.columns.flatMap((column) => column.statusIds));
  return statuses.filter((status) => !mapped.has(status.id));
}

/** Problems that would stop a save, worded for the column editor. */
export function columnProblems(config: BoardConfig): string[] {
  const problems: string[] = [];
  if (config.columns.length < MIN_COLUMNS) problems.push('A board needs two columns at least.');
  config.columns.forEach((column, index) => {
    if (!column.name.trim()) problems.push(`Column ${index + 1} needs a name.`);
  });
  const seen = new Set<string>();
  for (const column of config.columns) {
    const name = column.name.trim().toLowerCase();
    if (name && seen.has(name)) problems.push(`Two columns are called "${column.name.trim()}".`);
    seen.add(name);
  }
  return problems;
}

/** Issues the statuses hold, summed; statuses without a count hold none. */
export const issuesIn = (statusIds: readonly string[], counts: Record<string, number>) =>
  statusIds.reduce((sum, id) => sum + (counts[id] ?? 0), 0);

export interface HiddenWork {
  /** Columns that are gone and held issues, with how many. */
  removedColumns: { name: string; issues: number }[];
  /** Statuses that were on the board, are not any more and hold issues. */
  unmapped: { name: string; issues: number }[];
  /** Every issue that leaves the board with the change. */
  total: number;
}

/** What a column change takes off the board: the issues whose status no column shows any more. */
export function hiddenWork(
  before: BoardConfig,
  after: BoardConfig,
  statuses: readonly StatusInfo[],
  counts: Record<string, number>,
): HiddenWork {
  const kept = new Set(after.columns.flatMap((column) => column.statusIds));
  const keptColumns = new Set(after.columns.map((column) => column.id));
  const name = (id: string) => statuses.find((status) => status.id === id)?.name ?? 'A status';
  const removedColumns = before.columns
    .filter((column) => !keptColumns.has(column.id))
    .map((column) => ({
      name: column.name,
      issues: issuesIn(
        column.statusIds.filter((id) => !kept.has(id)),
        counts,
      ),
    }))
    .filter((entry) => entry.issues > 0);
  const inRemoved = new Set(
    before.columns
      .filter((column) => !keptColumns.has(column.id))
      .flatMap((column) => column.statusIds),
  );
  const unmapped = before.columns
    .filter((column) => keptColumns.has(column.id))
    .flatMap((column) => column.statusIds)
    .filter((id) => !kept.has(id) && !inRemoved.has(id) && (counts[id] ?? 0) > 0)
    .map((id) => ({ name: name(id), issues: counts[id] ?? 0 }));
  const gone = before.columns.flatMap((column) => column.statusIds).filter((id) => !kept.has(id));
  return { removedColumns, unmapped, total: issuesIn(gone, counts) };
}
