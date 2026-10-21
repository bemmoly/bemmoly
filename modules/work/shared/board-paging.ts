/*
 * The board view pages each column on its own: the first BOARD_PAGE_SIZE cards of every
 * column, then the next page of one column at a time, from a cursor naming the last card the
 * page before ended on. Columns are in rank order (rank, then issue id), so a cursor stays
 * valid while cards move above or below it. The server, the dev mock and the web cache share
 * these functions so they agree on the order and on the cursor.
 */

export const BOARD_PAGE_SIZE = 50;
export const BOARD_PAGE_MAX = 500;
/** The most cards one realtime patch reads back. */
export const BOARD_PATCH_MAX = 100;

export interface RankedCard {
  issueId: string;
  rank: string;
  columnId: string;
  /** The card's place in a query's ORDER BY; when set it orders the column instead of rank. */
  sortIndex?: number | null | undefined;
}

type CardKey = Pick<RankedCard, 'issueId' | 'rank' | 'sortIndex'>;

const UUID_LENGTH = 36;

/** `<issue id>.<rank>`, then `.<sort index>` on a sorted board; ranks hold no dots. */
export function boardCursor(card: CardKey): string {
  const base = `${card.issueId}.${card.rank}`;
  return card.sortIndex === null || card.sortIndex === undefined
    ? base
    : `${base}.${card.sortIndex}`;
}

/** The card a cursor names, or null for text that is not a cursor. */
export function readBoardCursor(cursor: string): CardKey | null {
  if (cursor.length <= UUID_LENGTH || cursor[UUID_LENGTH] !== '.') return null;
  const [rank = '', index] = cursor.slice(UUID_LENGTH + 1).split('.');
  const issueId = cursor.slice(0, UUID_LENGTH);
  if (index === undefined) return { issueId, rank };
  const sortIndex = Number(index);
  return Number.isInteger(sortIndex) ? { issueId, rank, sortIndex } : null;
}

/**
 * Board order: a query's sort index when both cards carry one, else rank, then issue id,
 * compared as the database's "C" collation compares them.
 */
export function compareRanked(a: CardKey, b: CardKey): number {
  const sorted = typeof a.sortIndex === 'number' && typeof b.sortIndex === 'number';
  if (sorted && a.sortIndex !== b.sortIndex) return (a.sortIndex ?? 0) - (b.sortIndex ?? 0);
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  if (a.issueId !== b.issueId) return a.issueId < b.issueId ? -1 : 1;
  return 0;
}

export interface BoardPageQuery {
  limit?: number | undefined;
  /** With `cursor`: only this column, from after the card the cursor names. */
  column?: string | undefined;
  cursor?: CardKey | null | undefined;
}

export interface BoardPage<C> {
  cards: C[];
  /** Each paged column's next cursor, null when the page reached its last card. */
  next: Map<string, string | null>;
}

export function pageBoardCards<C extends RankedCard>(
  cards: readonly C[],
  columnIds: readonly string[],
  query: BoardPageQuery,
): BoardPage<C> {
  const limit = query.limit ?? BOARD_PAGE_SIZE;
  const byColumn = new Map(columnIds.map((id) => [id, [] as C[]]));
  for (const card of cards) byColumn.get(card.columnId)?.push(card);
  const chosen = new Set<C>();
  const next = new Map<string, string | null>();
  for (const [columnId, list] of byColumn) {
    if (query.column !== undefined && columnId !== query.column) continue;
    list.sort(compareRanked);
    const after = query.cursor;
    const start = after ? list.findIndex((card) => compareRanked(card, after) > 0) : 0;
    const taken = start < 0 ? [] : list.slice(start, start + limit);
    for (const card of taken) chosen.add(card);
    const last = taken.at(-1);
    const more = start >= 0 && start + limit < list.length;
    next.set(columnId, more && last ? boardCursor(last) : null);
  }
  // In the order the cards came, the board's rank order, whichever columns they are in.
  return { cards: cards.filter((card) => chosen.has(card)), next };
}
