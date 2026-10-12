import { boardCursor, type BoardView } from '@bemmoly/module-work/shared';
import { describe, expect, it } from 'vitest';
import { card, STATUS, testView } from './board-fixtures.ts';
import { buildBoardModel } from './board-model.ts';
import { applyCardPatch, loadedDepth, mergeColumnPage } from './board-pages.ts';

/*
 * The cached view under paging and realtime patches: a page appended to its column, and each
 * patch move, update, insert and removal landing where the server puts the card, inside the
 * loaded part of its column only, with the counts the server read.
 */

type Card = BoardView['cards'][number];

/** "To do" holds b, d and f loaded, and goes on past f: 5 cards in all. */
function pagedView(): BoardView {
  const todo = [card(1, { rank: 'b' }), card(2, { rank: 'd' }), card(3, { rank: 'f' })];
  const doing = card(4, { rank: 'c', columnId: 'doing', statusId: STATUS.doing });
  const view = testView([...todo, doing]);
  return {
    ...view,
    columns: view.columns.map((column) =>
      column.id === 'todo' ? { ...column, count: 5, nextCursor: boardCursor(todo[2]!) } : column,
    ),
  };
}

/** The server's answer for some cards: the same board, with these cards and counts. */
function answer(view: BoardView, cards: Card[], counts: Record<string, number>): BoardView {
  return {
    ...view,
    columns: view.columns.map((column) => ({
      ...column,
      count: counts[column.id] ?? column.count,
      nextCursor: null,
    })),
    cards,
  };
}

const keys = (view: BoardView, columnId: string) =>
  view.cards
    .filter((entry) => entry.columnId === columnId)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
    .map((entry) => entry.key);

describe('applyCardPatch', () => {
  it('moves a card between columns and takes the counts the server read', () => {
    const view = pagedView();
    const moved = card(1, { rank: 'e', columnId: 'doing', statusId: STATUS.doing });
    const next = applyCardPatch(view, answer(view, [moved], { todo: 4, doing: 2 }), [
      moved.issueId,
    ]);
    expect(next).not.toBeNull();
    expect(keys(next!, 'todo')).toEqual(['PLT-2', 'PLT-3']);
    expect(keys(next!, 'doing')).toEqual(['PLT-4', 'PLT-1']);
    const columns = buildBoardModel(next!).columns;
    expect(columns.find((column) => column.id === 'todo')).toMatchObject({ count: 4, more: 2 });
    // The column's cursor is the view's own, not the patch's.
    expect(next!.columns[0]!.nextCursor).toBe(view.columns[0]!.nextCursor);
  });

  it('updates a card in place and leaves every other card the same object', () => {
    const view = pagedView();
    const renamed = { ...view.cards[1]!, title: 'Renamed' };
    const next = applyCardPatch(view, answer(view, [renamed], {}), [renamed.issueId])!;
    expect(next.cards[1]!.title).toBe('Renamed');
    expect(next.cards[0]).toBe(view.cards[0]);
    expect(next.cards[2]).toBe(view.cards[2]);
  });

  it('keeps the same view when the patch changes nothing', () => {
    const view = pagedView();
    const same = applyCardPatch(view, answer(view, [view.cards[0]!], {}), [view.cards[0]!.issueId]);
    expect(same!.cards).toBe(view.cards);
    expect(same!.lanes).toBe(view.lanes);
  });

  it('inserts a new card inside the loaded part of its column', () => {
    const view = pagedView();
    const created = card(9, { rank: 'c' });
    const next = applyCardPatch(view, answer(view, [created], { todo: 6 }), [created.issueId])!;
    expect(keys(next, 'todo')).toEqual(['PLT-1', 'PLT-9', 'PLT-2', 'PLT-3']);
  });

  it('counts a card that lands past the loaded part without drawing it', () => {
    const view = pagedView();
    const far = card(2, { rank: 'x' });
    const next = applyCardPatch(view, answer(view, [far], { todo: 5 }), [far.issueId])!;
    expect(keys(next, 'todo')).toEqual(['PLT-1', 'PLT-3']);
    expect(buildBoardModel(next).columns[0]).toMatchObject({ count: 5, more: 3 });
  });

  it('removes a card the answer lacks: deleted, or no longer on this board', () => {
    const view = pagedView();
    const gone = view.cards[3]!;
    const next = applyCardPatch(view, answer(view, [], { doing: 0 }), [gone.issueId])!;
    expect(next.cards.map((entry) => entry.key)).not.toContain(gone.key);
    expect(next.columns.find((column) => column.id === 'doing')!.count).toBe(0);
  });

  it('refuses a patch only a full read can apply: new config, other sprint, other columns', () => {
    const view = pagedView();
    const id = [view.cards[0]!.issueId];
    const reconfigured = { ...answer(view, [], {}), board: { ...view.board, updatedAt: 'later' } };
    expect(applyCardPatch(view, reconfigured, id)).toBeNull();
    const sprint = { ...answer(view, [], {}), sprintId: '018f0000-0000-7000-8000-0000000000ff' };
    expect(applyCardPatch(view, sprint, id)).toBeNull();
    const fewer = { ...answer(view, [], {}), columns: view.columns.slice(1) };
    expect(applyCardPatch(view, fewer, id)).toBeNull();
  });
});

describe('mergeColumnPage', () => {
  it('appends the page to its column, takes its cursor and skips cards already there', () => {
    const view = pagedView();
    const page = answer(view, [view.cards[2]!, card(5, { rank: 'h' }), card(6, { rank: 'j' })], {
      todo: 5,
    });
    const merged = mergeColumnPage(view, 'todo', page);
    expect(keys(merged, 'todo')).toEqual(['PLT-1', 'PLT-2', 'PLT-3', 'PLT-5', 'PLT-6']);
    expect(merged.columns[0]!.nextCursor).toBeNull();
    expect(merged.columns[1]).toBe(view.columns[1]);
    expect(buildBoardModel(merged).columns[0]).toMatchObject({ count: 5, more: 0 });
  });
});

describe('loadedDepth', () => {
  it('reads as deep as the deepest column, never below a page or above the most', () => {
    expect(loadedDepth(undefined)).toBe(50);
    expect(loadedDepth(pagedView())).toBe(50);
    const deep = testView(Array.from({ length: 80 }, (_, n) => card(n, { rank: `b${n}` })));
    expect(loadedDepth(deep)).toBe(80);
  });
});
