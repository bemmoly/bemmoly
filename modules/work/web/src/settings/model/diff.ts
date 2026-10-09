import type { BoardConfig, SchemeDiffEntry } from '@bemmoly/module-work/shared';
import { CARD_FIELD_LABELS, ESTIMATE_LABELS, LANE_LABELS, COLOR_RULE_LABELS } from './labels.ts';

/*
 * The diff of two board configs, row by row in the shape of the scheme diff
 * the server returns, so "View diff" against the org default, the review
 * before a save and the review before a reset share one list. Values are
 * written for people: status names instead of ids, labels instead of keys.
 */

export type StatusNames = (id: string) => string;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const onOff = (value: boolean) => (value ? 'On' : 'Off');
const list = (items: readonly string[]) => (items.length > 0 ? items.join(', ') : 'None');

function entry(
  key: string,
  label: string,
  before: unknown,
  after: unknown,
  attributes: string[] = [],
): SchemeDiffEntry {
  const change = before === undefined ? 'added' : after === undefined ? 'removed' : 'changed';
  return {
    key,
    label,
    change,
    attributes,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  };
}

type Column = BoardConfig['columns'][number];

function describeColumn(column: Column, names: StatusNames): string {
  const parts = [list(column.statusIds.map(names))];
  if (column.wipLimit) parts.push(`WIP ${column.wipLimit}`);
  if (column.done) parts.push('resolves');
  return parts.join(' · ');
}

function columnRows(before: BoardConfig, after: BoardConfig, names: StatusNames) {
  const rows: SchemeDiffEntry[] = [];
  const old = new Map(before.columns.map((column) => [column.id, column]));
  const now = new Map(after.columns.map((column) => [column.id, column]));
  for (const column of after.columns) {
    const was = old.get(column.id);
    const label = `Column "${column.name}"`;
    if (!was) {
      rows.push(entry(`columns.${column.id}`, label, undefined, describeColumn(column, names)));
      continue;
    }
    const attributes = [
      was.name !== column.name ? 'name' : null,
      !same(was.statusIds, column.statusIds) ? 'statuses' : null,
      was.wipLimit !== column.wipLimit ? 'WIP limit' : null,
      was.done !== column.done ? 'resolves' : null,
    ].filter((item): item is string => item !== null);
    if (attributes.length === 0) continue;
    const beforeText =
      was.name === column.name
        ? describeColumn(was, names)
        : `${was.name}: ${describeColumn(was, names)}`;
    rows.push(
      entry(`columns.${column.id}`, label, beforeText, describeColumn(column, names), attributes),
    );
  }
  for (const column of before.columns) {
    if (!now.has(column.id)) {
      rows.push(
        entry(
          `columns.${column.id}`,
          `Column "${column.name}"`,
          describeColumn(column, names),
          undefined,
        ),
      );
    }
  }
  const order = (config: BoardConfig, keep: Set<string>) =>
    config.columns.filter((column) => keep.has(column.id)).map((column) => column.id);
  const common = new Set(after.columns.filter((c) => old.has(c.id)).map((c) => c.id));
  if (!same(order(before, common), order(after, common))) {
    rows.push(
      entry(
        'columns.order',
        'Column order',
        list(before.columns.map((c) => c.name)),
        list(after.columns.map((c) => c.name)),
      ),
    );
  }
  return rows;
}

type Named = { name: string; query: string };

/** Named LQL lists (lanes, quick filters) matched by name. */
function namedRows(key: string, noun: string, before: readonly Named[], after: readonly Named[]) {
  const rows: SchemeDiffEntry[] = [];
  const old = new Map(before.map((item) => [item.name, item.query]));
  for (const item of after) {
    const was = old.get(item.name);
    if (was === undefined)
      rows.push(entry(`${key}.${item.name}`, `${noun} "${item.name}"`, undefined, item.query));
    else if (was !== item.query)
      rows.push(entry(`${key}.${item.name}`, `${noun} "${item.name}"`, was, item.query, ['query']));
  }
  const now = new Set(after.map((item) => item.name));
  for (const item of before) {
    if (!now.has(item.name))
      rows.push(entry(`${key}.${item.name}`, `${noun} "${item.name}"`, item.query, undefined));
  }
  if (rows.length === 0 && !same(before, after)) {
    rows.push(
      entry(key, `${noun} order`, list(before.map((i) => i.name)), list(after.map((i) => i.name))),
    );
  }
  return rows;
}

function scalar<T>(key: string, label: string, a: T, b: T, show: (value: T) => string) {
  return same(a, b) ? [] : [entry(key, label, show(a), show(b))];
}

/** Every setting that differs from `before` to `after`, in the order of the settings tabs. */
export function boardConfigDiff(
  before: BoardConfig,
  after: BoardConfig,
  names: StatusNames,
): SchemeDiffEntry[] {
  const fields = (items: BoardConfig['cardFields']) =>
    list(items.map((field) => CARD_FIELD_LABELS[field]));
  const rules = (config: BoardConfig) =>
    config.colorRules.map((rule) => ({ name: rule.color, query: rule.query }));
  return [
    ...columnRows(before, after, names),
    ...scalar(
      'collapseEmptyColumns',
      'Let members collapse columns',
      before.collapseEmptyColumns,
      after.collapseEmptyColumns,
      onOff,
    ),
    ...scalar(
      'showColumnCounts',
      'Issue count in column header',
      before.showColumnCounts,
      after.showColumnCounts,
      onOff,
    ),
    ...scalar(
      'showUnassigned',
      'Highlight unassigned issues',
      before.showUnassigned,
      after.showUnassigned,
      onOff,
    ),
    ...scalar(
      'lanes.kind',
      'Default swimlanes',
      before.lanes.kind,
      after.lanes.kind,
      (k) => LANE_LABELS[k],
    ),
    ...namedRows('lanes.queries', 'Lane', before.lanes.queries, after.lanes.queries),
    ...scalar(
      'lanes.showEmpty',
      'Show empty lanes',
      before.lanes.showEmpty,
      after.lanes.showEmpty,
      onOff,
    ),
    ...scalar(
      'lanes.collapsible',
      'Collapse lanes when more than 6',
      before.lanes.collapsible,
      after.lanes.collapsible,
      onOff,
    ),
    ...scalar(
      'lanes.totals',
      'Lane totals and progress',
      before.lanes.totals,
      after.lanes.totals,
      onOff,
    ),
    ...namedRows('quickFilters', 'Quick filter', before.quickFilters, after.quickFilters),
    ...scalar('cardFields', 'Card fields', before.cardFields, after.cardFields, fields),
    ...scalar(
      'colorRule',
      'Card color',
      before.colorRule,
      after.colorRule,
      (r) => COLOR_RULE_LABELS[r],
    ),
    ...scalar('colorRules', 'Color rules', rules(before), rules(after), (r) =>
      list(r.map((rule) => `${rule.query} → ${rule.name}`)),
    ),
    ...scalar(
      'estimationUnit',
      'Estimation',
      before.estimationUnit,
      after.estimationUnit,
      (u) => ESTIMATE_LABELS[u],
    ),
    ...scalar(
      'cadenceDays',
      'Sprint length',
      before.cadenceDays,
      after.cadenceDays,
      (d) => `${d} days`,
    ),
    ...scalar('workingDays', 'Working days', before.workingDays, after.workingDays, (d) => list(d)),
  ];
}

/**
 * The org default board re-pointed at the project's statuses by name, as the
 * server does when a project's first board is made. Columns whose statuses
 * the project lacks keep no statuses rather than vanishing, so the reset
 * shows them.
 */
export function adoptOrgConfig(
  org: BoardConfig,
  orgNames: StatusNames,
  projectStatuses: readonly { id: string; name: string }[],
): BoardConfig {
  const byName = new Map(projectStatuses.map((status) => [status.name.toLowerCase(), status.id]));
  return {
    ...structuredClone(org),
    columns: org.columns.map((column) => ({
      ...column,
      statusIds: column.statusIds
        .map((id) => byName.get(orgNames(id).toLowerCase()))
        .filter((id): id is string => Boolean(id)),
    })),
  };
}
