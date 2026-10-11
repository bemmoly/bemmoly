import { describe, expect, it } from 'vitest';
import {
  initialTarget,
  rowAfter,
  screenOrder,
  slotsOf,
  stepTarget,
  type ContainerLayout,
} from './backlog-slots.ts';

const LAYOUT: ContainerLayout[] = [
  { id: 's14', visibleIds: ['a', 'b', 'c'], open: true },
  { id: 's15', visibleIds: ['d'], open: false },
  { id: 'backlog', visibleIds: ['e', 'f'], open: true },
];

describe('drop slots', () => {
  it('lists a place above every row and one after the last, one for a collapsed container', () => {
    expect(slotsOf(LAYOUT, new Set(['b']))).toEqual([
      { containerId: 's14', beforeId: 'a' },
      { containerId: 's14', beforeId: 'c' },
      { containerId: 's14', beforeId: null },
      { containerId: 's15', beforeId: null },
      { containerId: 'backlog', beforeId: 'e' },
      { containerId: 'backlog', beforeId: 'f' },
      { containerId: 'backlog', beforeId: null },
    ]);
  });

  it('starts a pick-up where the rows already are', () => {
    expect(initialTarget(LAYOUT, ['b'])).toEqual({ containerId: 's14', beforeId: 'c' });
    expect(initialTarget(LAYOUT, ['a', 'c'])).toEqual({ containerId: 's14', beforeId: null });
    expect(initialTarget(LAYOUT, ['zz'])).toBeNull();
  });

  it('steps up and down across containers and stops at the ends', () => {
    const moving = new Set(['c']);
    const end14 = { containerId: 's14', beforeId: null };
    expect(stepTarget(LAYOUT, moving, end14, 1)).toEqual({ containerId: 's15', beforeId: null });
    expect(stepTarget(LAYOUT, moving, end14, 2)).toEqual({ containerId: 'backlog', beforeId: 'e' });
    expect(stepTarget(LAYOUT, moving, { containerId: 's14', beforeId: 'a' }, -1)).toEqual({
      containerId: 's14',
      beforeId: 'a',
    });
    expect(stepTarget(LAYOUT, moving, { containerId: 'backlog', beforeId: null }, 1)).toEqual({
      containerId: 'backlog',
      beforeId: null,
    });
  });

  it('finds the next row and the screen order of open containers', () => {
    expect(rowAfter(LAYOUT, 's14', 'b')).toBe('c');
    expect(rowAfter(LAYOUT, 's14', 'c')).toBeNull();
    expect(screenOrder(LAYOUT)).toEqual(['a', 'b', 'c', 'e', 'f']);
  });
});
