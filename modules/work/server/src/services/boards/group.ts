import type { BoardCard, BoardConfig, BoardView } from '../../../../shared/boards.ts';
import { ISSUE_PRIORITIES } from '../../../../shared/enums.ts';

/*
 * Pure grouping of a board's cards into its columns and swimlanes. The
 * statement hands the cards over in rank order, so each column and lane keeps
 * that order without sorting here.
 */

export interface GroupCard {
  card: BoardCard;
  /** The epic the card rolls up to, when its parent is one. */
  epicId: string | null;
  /** The first named lane query the card matches, by index, or null for none. */
  queryLane: number | null;
}

export interface LaneNames {
  /** Epics in rank order with what their lane header prints. */
  epics: ReadonlyMap<string, { key: string; title: string; dueAt: string | null }>;
  users: ReadonlyMap<string, string>;
  /** Issue types in their scheme order. */
  types: ReadonlyMap<string, string>;
}

type Lane = BoardView['lanes'][number];
type Placed = BoardView['cards'][number];

const NONE = 'none';

const lane = (id: string, label: string, extra: Partial<Lane> = {}): Lane => ({
  id,
  label,
  color: null,
  issueKey: null,
  dueAt: null,
  ...extra,
});

function laneOf(config: BoardConfig, { card, epicId, queryLane }: GroupCard): string {
  switch (config.lanes.kind) {
    case 'epic':
      return epicId ?? NONE;
    case 'assignee':
      return card.assigneeId ?? NONE;
    case 'priority':
      return card.priority;
    case 'type':
      return card.typeId;
    case 'query':
      return queryLane === null ? NONE : `query-${queryLane}`;
    case 'none':
      return 'all';
  }
}

function allLanes(config: BoardConfig, names: LaneNames): Lane[] {
  switch (config.lanes.kind) {
    case 'epic':
      return [
        ...[...names.epics].map(([id, epic]) =>
          lane(id, epic.title, { issueKey: epic.key, dueAt: epic.dueAt }),
        ),
        lane(NONE, 'No epic'),
      ];
    case 'assignee':
      return [
        ...[...names.users]
          .sort((a, b) => a[1].localeCompare(b[1]))
          .map(([id, name]) => lane(id, name)),
        lane(NONE, 'Unassigned'),
      ];
    case 'priority':
      return ISSUE_PRIORITIES.map((priority) =>
        lane(priority, priority[0]?.toUpperCase() + priority.slice(1)),
      );
    case 'type':
      return [...names.types].map(([id, name]) => lane(id, name));
    case 'query':
      return [
        ...config.lanes.queries.map((query, index) => lane(`query-${index}`, query.name)),
        lane(NONE, 'Everything else'),
      ];
    case 'none':
      return [lane('all', 'All issues')];
  }
}

/** The column each status belongs to; a status in no column keeps its cards off the board. */
export function columnOfStatus(config: BoardConfig): Map<string, string> {
  const map = new Map<string, string>();
  for (const column of config.columns) {
    for (const statusId of column.statusIds) map.set(statusId, column.id);
  }
  return map;
}

export function groupBoard(
  config: BoardConfig,
  cards: readonly GroupCard[],
  names: LaneNames,
): Pick<BoardView, 'columns' | 'lanes' | 'cards'> {
  const columnOf = columnOfStatus(config);
  const placed: Placed[] = [];
  const counts = new Map<string, number>();
  const used = new Set<string>();
  for (const entry of cards) {
    const columnId = columnOf.get(entry.card.statusId);
    if (!columnId) continue;
    const laneId = laneOf(config, entry);
    placed.push({ ...entry.card, columnId, laneId });
    counts.set(columnId, (counts.get(columnId) ?? 0) + 1);
    used.add(laneId);
  }
  const keepAll = config.lanes.showEmpty || config.lanes.kind === 'query';
  const lanes = allLanes(config, names).filter((entry) => keepAll || used.has(entry.id));
  return {
    columns: config.columns.map((column) => {
      const count = counts.get(column.id) ?? 0;
      const wipLimit = column.wipLimit ?? null;
      return { id: column.id, count, wipLimit, overWip: wipLimit !== null && count > wipLimit };
    }),
    lanes,
    cards: placed,
  };
}
