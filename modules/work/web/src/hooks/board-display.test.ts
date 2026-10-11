import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISPLAY,
  shownFields,
  useBoardDisplay,
  useBoardDisplayStore,
  visibleColumns,
} from './board-display.ts';

const BOARD_FIELDS = ['type', 'key', 'priority', 'labels', 'estimate', 'assignee'] as const;
const STORAGE = 'bemmoly.work.board-display';

beforeEach(() => {
  window.localStorage.clear();
  useBoardDisplayStore.setState({ views: {} });
});
afterEach(() => vi.restoreAllMocks());

describe('shownFields', () => {
  it("draws exactly the board's card fields, plus the time in column", () => {
    expect([...shownFields([...BOARD_FIELDS])]).toEqual([
      'key',
      'priority',
      'estimate',
      'age',
      'assignee',
      'labels',
    ]);
    // A board that hides the key and priority hides them for everyone.
    expect([...shownFields(['type'])]).toEqual(['age']);
  });
});

describe('visibleColumns', () => {
  const columns = [{ count: 2 }, { count: 0 }, { count: 1 }];

  it('hides empty columns only when asked, and never while a card is carried', () => {
    expect(visibleColumns(columns, true, false)).toHaveLength(3);
    expect(visibleColumns(columns, false, false)).toEqual([{ count: 2 }, { count: 1 }]);
    expect(visibleColumns(columns, false, true)).toHaveLength(3);
  });

  it('keeps every heading when the whole board is empty', () => {
    expect(visibleColumns([{ count: 0 }, { count: 0 }], false, false)).toHaveLength(2);
  });
});

describe('useBoardDisplay', () => {
  const render = (personId = 'me', boardId = 'board-1') =>
    renderHook(() => useBoardDisplay(boardId, personId, BOARD_FIELDS)).result;

  it('keeps the empty-column choice per person and per board, in this browser', () => {
    const mine = render();
    act(() => mine.current.setShowEmptyColumns(false));
    expect(mine.current.display.showEmptyColumns).toBe(false);
    expect(mine.current.customized).toBe(true);
    expect(render('someone-else').current.display).toEqual(DEFAULT_DISPLAY);
    expect(render('me', 'board-2').current.display).toEqual(DEFAULT_DISPLAY);
    expect(window.localStorage.getItem(STORAGE)).toContain('showEmptyColumns');
  });

  it('resets to the board, and survives storage that refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const view = render();
    act(() => view.current.setShowEmptyColumns(false));
    expect(view.current.display.showEmptyColumns).toBe(false);
    act(() => view.current.reset());
    expect(view.current.display).toEqual(DEFAULT_DISPLAY);
  });

  it('ignores card fields and density stored by older versions', async () => {
    window.localStorage.setItem(
      STORAGE,
      JSON.stringify({
        state: {
          views: {
            'me:board-1': { fields: { key: false }, density: 'compact', showEmptyColumns: false },
            'me:board-2': { fields: { labels: false }, density: 'compact', showEmptyColumns: true },
            'me:board-3': { density: 'huge' },
          },
        },
        version: 1,
      }),
    );
    await act(() => useBoardDisplayStore.persist.rehydrate());
    expect(render().current.display).toEqual({ showEmptyColumns: false });
    expect(render().current.shown.has('key')).toBe(true);
    expect(render('me', 'board-2').current.display).toEqual(DEFAULT_DISPLAY);
    expect(render('me', 'board-2').current.shown.has('labels')).toBe(true);
    expect(render('me', 'board-3').current.display).toEqual(DEFAULT_DISPLAY);
  });
});
