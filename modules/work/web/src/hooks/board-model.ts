import type { BoardView } from '@bemmoly/module-work/shared';
import { EPIC_PALETTE, epicColor, type EpicColor } from '@bemmoly/ui';

/*
 * The board as the screen lays it out: the view's columns with their names, and each lane's
 * cards split into one rank-ordered list per column. Pure, so drag logic and tests share it.
 */

export type ViewCard = BoardView['cards'][number];

export interface ColumnModel {
  id: string;
  name: string;
  statusIds: readonly string[];
  count: number;
  wipLimit: number | null;
  overWip: boolean;
  done: boolean;
}

export interface LaneModel {
  id: string;
  label: string;
  issueKey: string | null;
  dueAt: string | null;
  /** The epic's stored colour, a palette colour for other lanes; null for the catch-all grey. */
  color: EpicColor | null;
  /** Card lists by column id, in rank order. */
  cells: Readonly<Record<string, readonly ViewCard[]>>;
  count: number;
  points: number;
  donePoints: number;
  inFlight: number;
}

export interface BoardModel {
  columns: ColumnModel[];
  lanes: LaneModel[];
}

/** "Group by" on the toolbar: the board's configured lanes, or one lane holding everything. */
export type BoardGrouping = 'lanes' | 'none';

export const ALL_LANE = 'all';

/** The catch-all lanes ("No epic", "Unassigned") are grey; every other lane takes a hue. */
const NO_LANE = new Set(['none']);

export const byRank = (a: ViewCard, b: ViewCard) =>
  a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0;

/** Where a card is drawn under a grouping; with "none" every card is in the one lane. */
export const laneOfCard = (card: ViewCard, grouping: BoardGrouping) =>
  grouping === 'none' ? ALL_LANE : card.laneId;

export function buildColumns(view: BoardView): ColumnModel[] {
  const counts = new Map(view.columns.map((column) => [column.id, column]));
  return view.board.config.columns.map((column) => {
    const live = counts.get(column.id);
    const wipLimit = live?.wipLimit ?? column.wipLimit ?? null;
    const count = live?.count ?? 0;
    return {
      id: column.id,
      name: column.name,
      statusIds: column.statusIds,
      count,
      wipLimit,
      overWip: live?.overWip ?? (wipLimit !== null && count > wipLimit),
      done: column.done ?? false,
    };
  });
}

function lanesOf(view: BoardView, grouping: BoardGrouping) {
  if (grouping === 'none' || view.lanes.length === 0) {
    return [{ id: ALL_LANE, label: 'All issues', issueKey: null, dueAt: null, color: null }];
  }
  let next = 0;
  return view.lanes.map((lane) => ({
    id: lane.id,
    label: lane.label,
    issueKey: lane.issueKey ?? null,
    dueAt: lane.dueAt ?? null,
    color: NO_LANE.has(lane.id)
      ? null
      : lane.issueKey
        ? epicColor(lane.color, lane.id)
        : (EPIC_PALETTE[next++ % EPIC_PALETTE.length] ?? null),
  }));
}

/**
 * Lays the board out. With `keep`, cards it rejects are left out and the column counts are the
 * shown cards, so a filtered board never shows a number its cards contradict.
 */
export function buildBoardModel(
  view: BoardView,
  grouping: BoardGrouping = 'lanes',
  keep?: (card: ViewCard) => boolean,
): BoardModel {
  const cards = keep ? view.cards.filter(keep) : view.cards;
  const columns = buildColumns(view).map((column) => {
    if (!keep) return column;
    const count = cards.filter((card) => card.columnId === column.id).length;
    return { ...column, count, overWip: column.wipLimit !== null && count > column.wipLimit };
  });
  const doneColumns = new Set(columns.filter((column) => column.done).map((column) => column.id));
  const firstColumn = columns[0]?.id;
  const lanes = lanesOf(view, view.lanes.length === 0 ? 'none' : grouping).map((lane) => {
    const cells: Record<string, ViewCard[]> = Object.fromEntries(
      columns.map((column) => [column.id, []]),
    );
    let count = 0;
    let points = 0;
    let donePoints = 0;
    let inFlight = 0;
    for (const card of cards) {
      if (laneOfCard(card, lane.id === ALL_LANE ? 'none' : 'lanes') !== lane.id) continue;
      const cell = cells[card.columnId];
      if (!cell) continue;
      cell.push(card);
      count += 1;
      points += card.estimate ?? 0;
      if (doneColumns.has(card.columnId)) donePoints += card.estimate ?? 0;
      else if (card.columnId !== firstColumn) inFlight += 1;
    }
    for (const cell of Object.values(cells)) cell.sort(byRank);
    return { ...lane, cells, count, points, donePoints, inFlight };
  });
  return { columns, lanes };
}

/** The card's column and position within its cell, or null when it is not on the board. */
export function locateCard(model: BoardModel, issueId: string) {
  for (const lane of model.lanes) {
    for (const [columnId, cards] of Object.entries(lane.cells)) {
      const index = cards.findIndex((card) => card.issueId === issueId);
      if (index >= 0) return { laneId: lane.id, columnId, index, card: cards[index] as ViewCard };
    }
  }
  return null;
}

/** Issue keys in the order the board shows them: lane by lane, column by column, top down. */
export function boardIssueOrder(model: BoardModel): string[] {
  return model.lanes.flatMap((lane) =>
    model.columns.flatMap((column) => (lane.cells[column.id] ?? []).map((card) => card.key)),
  );
}
