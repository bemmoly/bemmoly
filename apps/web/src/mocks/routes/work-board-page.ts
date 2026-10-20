import type { MockRequest } from '../types.ts';

/*
 * The board view's paging, as the server answers it (modules/work/shared/board-paging.ts; the
 * shell does not import a module, so the mock keeps its own copy): fifty cards per column in
 * rank order, a cursor naming the last card of a page, the next page of one column, or only the
 * named cards for a realtime patch. Counts always cover every card.
 */

const PAGE = 50;
const UUID_LENGTH = 36;

interface Ranked {
  issueId: string;
  rank: string;
  columnId: string;
}

export interface BoardPageQuery {
  limit: number;
  column: string | null;
  cursor: { issueId: string; rank: string } | null;
  issueIds: Set<string> | null;
}

const compare = (a: Omit<Ranked, 'columnId'>, b: Omit<Ranked, 'columnId'>) =>
  a.rank !== b.rank ? (a.rank < b.rank ? -1 : 1) : a.issueId < b.issueId ? -1 : 1;

export function pageQuery(request: MockRequest): BoardPageQuery | string {
  const limit = Number(request.query.get('limit') ?? PAGE);
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) return 'The limit is out of range';
  const text = request.query.get('cursor');
  const column = request.query.get('column');
  if (text && !column) return 'A cursor pages one column';
  const cursor =
    text && text.length > UUID_LENGTH && text[UUID_LENGTH] === '.'
      ? {
          issueId: text.slice(0, UUID_LENGTH),
          rank: text.slice(UUID_LENGTH + 1).split('.')[0] ?? '',
        }
      : null;
  if (text && !cursor) return 'The cursor is not one this board gave';
  const ids = request.query.get('issueIds');
  return { limit, column, cursor, issueIds: ids ? new Set(ids.split(',')) : null };
}

export function pageCards<C extends Ranked>(cards: readonly C[], query: BoardPageQuery) {
  const next = new Map<string, string | null>();
  if (query.issueIds) {
    const wanted = query.issueIds;
    return { cards: cards.filter((card) => wanted.has(card.issueId)), next };
  }
  const columns = new Map<string, C[]>();
  for (const card of cards)
    columns.set(card.columnId, [...(columns.get(card.columnId) ?? []), card]);
  const chosen = new Set<C>();
  for (const [columnId, list] of columns) {
    if (query.column !== null && columnId !== query.column) continue;
    list.sort(compare);
    const after = query.cursor;
    const start = after ? list.findIndex((card) => compare(card, after) > 0) : 0;
    const taken = start < 0 ? [] : list.slice(start, start + query.limit);
    for (const card of taken) chosen.add(card);
    const last = taken.at(-1);
    const more = start >= 0 && start + query.limit < list.length;
    next.set(columnId, more && last ? `${last.issueId}.${last.rank}` : null);
  }
  // In the order the cards came, the board's rank order, whichever columns they are in.
  return { cards: cards.filter((card) => chosen.has(card)), next };
}
