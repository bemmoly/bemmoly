import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_DISPLAY,
  isCustomized,
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
  it("starts from the board's card fields, plus what every card always drew", () => {
    const shown = shownFields(DEFAULT_DISPLAY, [...BOARD_FIELDS]);
    expect([...shown]).toEqual(['key', 'priority', 'estimate', 'age', 'assignee', 'labels']);
    expect(shownFields(DEFAULT_DISPLAY, []).has('labels')).toBe(false);
  });

  it("lays a person's choices over the board's", () => {
    const display = { ...DEFAULT_DISPLAY, fields: { labels: false, subtasks: true } };
    const shown = shownFields(display, [...BOARD_FIELDS]);
    expect(shown.has('labels')).toBe(false);
    expect(shown.has('subtasks')).toBe(true);
    expect(isCustomized(display)).toBe(true);
    expect(isCustomized(DEFAULT_DISPLAY)).toBe(false);
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

  it('keeps choices per person and per board, in this browser', () => {
    const mine = render();
    act(() => mine.current.setField('labels', false));
    act(() => mine.current.setDensity('compact'));
    expect(mine.current.shown.has('labels')).toBe(false);
    expect(mine.current.display.density).toBe('compact');
    expect(render('someone-else').current.display).toEqual(DEFAULT_DISPLAY);
    expect(render('me', 'board-2').current.display).toEqual(DEFAULT_DISPLAY);
    expect(window.localStorage.getItem(STORAGE)).toContain('compact');
  });

  it("follows the board again once a field is set back to the board's choice", () => {
    const view = render();
    act(() => view.current.setField('labels', false));
    act(() => view.current.setField('labels', true));
    expect(view.current.display.fields).toEqual({});
    expect(view.current.customized).toBe(false);
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

  it('ignores stored views it cannot read', async () => {
    window.localStorage.setItem(
      STORAGE,
      JSON.stringify({
        state: {
          views: {
            'me:board-1': { fields: { key: false }, density: 'compact', showEmptyColumns: true },
            'me:board-2': { density: 'huge' },
          },
        },
        version: 1,
      }),
    );
    await act(() => useBoardDisplayStore.persist.rehydrate());
    expect(render().current.display.density).toBe('compact');
    expect(render().current.shown.has('key')).toBe(false);
    expect(render('me', 'board-2').current.display).toEqual(DEFAULT_DISPLAY);
  });
});
