import {
  BOARD_PAGE_MAX,
  BOARD_PAGE_SIZE,
  compareRanked,
  readBoardCursor,
  type BoardView,
} from '@bemmoly/module-work/shared';

/*
 * The board's cache holds one view per board and filter: the first page of every column, plus
 * the pages "Load more" appended. These pure steps keep that view whole: a page merged in, a
 * realtime patch applied to the cards it names, and how deep a refetch must read to keep what
 * is on screen. Each answers from the view alone, so the hooks and tests share them.
 */

type Card = BoardView['cards'][number];
type Column = BoardView['columns'][number];

const same = <T>(a: T, b: T) => JSON.stringify(a) === JSON.stringify(b);
/** The old value when the new one reads the same, so memos keyed on it hold. */
const kept = <T>(before: T, after: T): T => (same(before, after) ? before : after);

/** Cards of each column in this view. */
export function loadedCounts(view: BoardView): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of view.cards) counts.set(card.columnId, (counts.get(card.columnId) ?? 0) + 1);
  return counts;
}

/**
 * The page size a refetch asks for so no column shows fewer cards than it does now: the
 * deepest column's count, never below one page.
 */
export function loadedDepth(view: BoardView | undefined): number {
  if (!view) return BOARD_PAGE_SIZE;
  const deepest = Math.max(0, ...loadedCounts(view).values());
  return Math.min(BOARD_PAGE_MAX, Math.max(BOARD_PAGE_SIZE, deepest));
}

/** Whether a card at its place falls in the part of its column this view has loaded. */
function inLoadedPart(columns: readonly Column[], card: Card): boolean {
  const column = columns.find((entry) => entry.id === card.columnId);
  if (!column) return false;
  if (column.nextCursor === null) return true;
  const end = readBoardCursor(column.nextCursor);
  return end !== null && compareRanked(card, end) <= 0;
}

/**
 * One column's next page appended: its cards, its new cursor, and every column's count, lane
 * and epic as the page read them.
 */
export function mergeColumnPage(view: BoardView, columnId: string, page: BoardView): BoardView {
  const have = new Set(view.cards.map((card) => card.issueId));
  const added = page.cards.filter((card) => card.columnId === columnId && !have.has(card.issueId));
  const fresh = new Map(page.columns.map((column) => [column.id, column]));
  const columns = view.columns.map((column) => {
    const read = fresh.get(column.id);
    if (!read) return column;
    const nextCursor = column.id === columnId ? read.nextCursor : column.nextCursor;
    return kept(column, { ...read, nextCursor });
  });
  return {
    ...view,
    columns: kept(view.columns, columns),
    lanes: kept(view.lanes, page.lanes),
    epics: kept(view.epics, page.epics),
    cards: added.length > 0 ? [...view.cards, ...added] : view.cards,
  };
}

/**
 * A realtime change to the cards `ids` names, applied from the server's answer for them: each
 * one leaves the view, and comes back where the answer puts it when that place is in the part
 * of its column already loaded. One the answer lacks has left the board. Counts, lanes, epics
 * and metrics come from the answer. Null when the answer is of a different board, sprint or
 * set of columns than the view: only a full read can apply that.
 */
export function applyCardPatch(
  view: BoardView,
  patch: BoardView,
  ids: readonly string[],
): BoardView | null {
  if (
    patch.board.id !== view.board.id ||
    patch.board.updatedAt !== view.board.updatedAt ||
    patch.sprintId !== view.sprintId ||
    patch.columns.length !== view.columns.length ||
    patch.columns.some((column, index) => column.id !== view.columns[index]?.id)
  ) {
    return null;
  }
  const columns = patch.columns.map((column, index) => {
    const before = view.columns[index];
    return before ? kept(before, { ...column, nextCursor: before.nextCursor }) : column;
  });
  const changed = new Set(ids);
  const arriving = new Map(
    patch.cards
      .filter((card) => changed.has(card.issueId) && inLoadedPart(columns, card))
      .map((card) => [card.issueId, card]),
  );
  // A card that stays keeps its slot in the list; one that leaves goes; one that arrives is
  // added. Cells sort by rank, so the list's own order only has to be stable.
  const cards: Card[] = [];
  for (const card of view.cards) {
    if (!changed.has(card.issueId)) cards.push(card);
    else {
      const next = arriving.get(card.issueId);
      if (next) {
        cards.push(same(card, next) ? card : next);
        arriving.delete(card.issueId);
      }
    }
  }
  cards.push(...arriving.values());
  return {
    ...view,
    columns: kept(view.columns, columns),
    lanes: kept(view.lanes, patch.lanes),
    epics: kept(view.epics, patch.epics),
    metrics: kept(view.metrics, patch.metrics),
    cards:
      cards.length === view.cards.length && cards.every((card, index) => card === view.cards[index])
        ? view.cards
        : cards,
  };
}
