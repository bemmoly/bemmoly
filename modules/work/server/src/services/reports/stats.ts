import type { StatBucket, StatCell, StatField, StatRow } from '../../../../shared/report-stats.ts';

/*
 * Field statistics as plain grouping over what the loader read: each issue
 * with the values it holds in a field. An issue with no value falls in the
 * field's "none" bucket, so every issue is counted at least once per field.
 */

/** One value an issue holds; `order` fixes buckets with a natural order (status, priority). */
export interface StatValue {
  id: string;
  label: string;
  order: number | null;
}

/** Issue id to the values it holds in one field; issues absent hold none. */
export type FieldValues = ReadonlyMap<string, readonly StatValue[]>;

export const NONE_LABELS: Record<StatField, string> = {
  status: 'No status',
  assignee: 'Unassigned',
  type: 'No type',
  priority: 'No priority',
  label: 'No label',
  epic: 'No epic',
  version: 'No version',
  component: 'No component',
};

const NONE = '\u0000none';

function bucketsOf(field: StatField, values: FieldValues, issueId: string): StatValue[] {
  const held = values.get(issueId);
  if (held && held.length > 0) return [...held];
  return [{ id: NONE, label: NONE_LABELS[field], order: null }];
}

/*
 * Natural order first where the field has one, then the biggest buckets, so
 * the chart reads top-down; the none bucket always goes last.
 */
function ordered(found: Map<string, StatValue & { count: number }>): StatRow[] {
  return [...found.values()]
    .sort((a, b) => {
      if ((a.id === NONE) !== (b.id === NONE)) return a.id === NONE ? 1 : -1;
      if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
      return b.count - a.count || a.label.localeCompare(b.label);
    })
    .map((item) => ({
      id: item.id === NONE ? null : item.id,
      label: item.label,
      count: item.count,
    }));
}

function tally(field: StatField, issueIds: readonly string[], values: FieldValues): StatRow[] {
  const found = new Map<string, StatValue & { count: number }>();
  for (const issueId of issueIds) {
    for (const value of bucketsOf(field, values, issueId)) {
      const entry = found.get(value.id) ?? { ...value, count: 0 };
      entry.count += 1;
      found.set(value.id, entry);
    }
  }
  return ordered(found);
}

export interface StatsInput {
  issueIds: readonly string[];
  by: StatField;
  byValues: FieldValues;
  by2?: { field: StatField; values: FieldValues } | undefined;
}

export interface StatsResult {
  rows: StatRow[];
  columns?: StatBucket[];
  cells?: StatCell[];
}

export function fieldStats(input: StatsInput): StatsResult {
  const rows = tally(input.by, input.issueIds, input.byValues);
  if (!input.by2) return { rows };
  const { field, values } = input.by2;
  const columns = tally(field, input.issueIds, values).map(({ id, label }) => ({ id, label }));
  const counts = new Map<string, StatCell>();
  for (const issueId of input.issueIds) {
    for (const row of bucketsOf(input.by, input.byValues, issueId)) {
      for (const column of bucketsOf(field, values, issueId)) {
        const key = `${row.id}\u0001${column.id}`;
        const cell = counts.get(key) ?? {
          row: row.id === NONE ? null : row.id,
          column: column.id === NONE ? null : column.id,
          count: 0,
        };
        cell.count += 1;
        counts.set(key, cell);
      }
    }
  }
  return { rows, columns, cells: [...counts.values()] };
}
