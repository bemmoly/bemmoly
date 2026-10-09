import { describe, expect, it } from 'vitest';
import {
  draggedIds,
  EMPTY_SELECTION,
  nextSelection,
  pruneSelection,
  type Selection,
} from './backlog-selection.ts';

const ORDER = ['a', 'b', 'c', 'd', 'e'];

describe('nextSelection', () => {
  it('picks one row on a plain click and makes it the anchor', () => {
    const picked = nextSelection({ ids: ['a', 'c'], anchor: 'a' }, 'd', {}, ORDER);
    expect(picked).toEqual({ ids: ['d'], anchor: 'd' });
  });

  it('toggles rows in and out with cmd or ctrl', () => {
    let state: Selection = nextSelection(EMPTY_SELECTION, 'b', {}, ORDER);
    state = nextSelection(state, 'd', { toggle: true }, ORDER);
    expect(state).toEqual({ ids: ['b', 'd'], anchor: 'd' });
    state = nextSelection(state, 'b', { toggle: true }, ORDER);
    expect(state).toEqual({ ids: ['d'], anchor: 'b' });
  });

  it('extends a range from the anchor with shift, in either direction', () => {
    const start = nextSelection(EMPTY_SELECTION, 'b', {}, ORDER);
    expect(nextSelection(start, 'd', { shift: true }, ORDER).ids).toEqual(['b', 'c', 'd']);
    const back = nextSelection(start, 'a', { shift: true }, ORDER);
    expect(back).toEqual({ ids: ['a', 'b'], anchor: 'b' });
  });

  it('adds a range to the selection with shift and cmd together', () => {
    const state = { ids: ['e'], anchor: 'a' };
    expect(nextSelection(state, 'b', { shift: true, toggle: true }, ORDER).ids).toEqual([
      'e',
      'a',
      'b',
    ]);
  });

  it('treats shift without an anchor as a plain click', () => {
    expect(nextSelection(EMPTY_SELECTION, 'c', { shift: true }, ORDER)).toEqual({
      ids: ['c'],
      anchor: 'c',
    });
  });
});

describe('draggedIds and pruneSelection', () => {
  it('drags the whole selection from a selected row, or just the row', () => {
    const state = { ids: ['a', 'c'], anchor: 'c' };
    expect(draggedIds(state, 'c')).toEqual(['a', 'c']);
    expect(draggedIds(state, 'b')).toEqual(['b']);
  });

  it('forgets rows that left the screen', () => {
    const state = { ids: ['a', 'c'], anchor: 'c' };
    expect(pruneSelection(state, new Set(['a']))).toEqual({ ids: ['a'], anchor: null });
    expect(pruneSelection(state, new Set(['a', 'c']))).toBe(state);
  });
});
