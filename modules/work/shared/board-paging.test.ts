import { describe, expect, it } from 'vitest';
import { boardCursor, pageBoardCards, readBoardCursor } from './board-paging.ts';

const id = (n: number) => `018f0000-0000-7000-8000-${n.toString(16).padStart(12, '0')}`;
const card = (n: number, rank: string, columnId = 'todo') => ({ issueId: id(n), rank, columnId });

describe('pageBoardCards', () => {
  const cards = [
    card(1, 'b'),
    card(2, 'c', 'done'),
    card(3, 'd'),
    card(4, 'f'),
    card(5, 'h'),
    card(6, 'k'),
  ];

  it('takes a page of every column in board order, with a cursor where a column goes on', () => {
    const page = pageBoardCards(cards, ['todo', 'done'], { limit: 2 });
    expect(page.cards.map((entry) => entry.issueId)).toEqual([id(1), id(2), id(3)]);
    expect(page.next.get('todo')).toBe(boardCursor(card(3, 'd')));
    expect(page.next.get('done')).toBeNull();
  });

  it('reads one column on from its cursor until the last page has none', () => {
    const cursor = readBoardCursor(boardCursor(card(3, 'd')));
    const second = pageBoardCards(cards, ['todo', 'done'], { limit: 2, column: 'todo', cursor });
    expect(second.cards.map((entry) => entry.issueId)).toEqual([id(4), id(5)]);
    expect(second.next.has('done')).toBe(false);
    const last = pageBoardCards(cards, ['todo', 'done'], {
      limit: 2,
      column: 'todo',
      cursor: readBoardCursor(second.next.get('todo')!),
    });
    expect(last.cards.map((entry) => entry.issueId)).toEqual([id(6)]);
    expect(last.next.get('todo')).toBeNull();
  });

  it('keeps its place when the card a cursor names has moved away', () => {
    const moved = cards.filter((entry) => entry.issueId !== id(3));
    const cursor = readBoardCursor(boardCursor(card(3, 'd')));
    const page = pageBoardCards(moved, ['todo'], { limit: 5, column: 'todo', cursor });
    expect(page.cards.map((entry) => entry.issueId)).toEqual([id(4), id(5), id(6)]);
  });

  it('reads only cursors it wrote', () => {
    expect(readBoardCursor('not-a-cursor')).toBeNull();
    expect(readBoardCursor(boardCursor(card(9, 'zz')))).toEqual({ issueId: id(9), rank: 'zz' });
  });
});
