import { describe, expect, it } from 'vitest';
import {
  focusForKey,
  isWithin,
  moveForDrop,
  moveForKey,
  rowForLetter,
  zoneAt,
  type PageTreeItem,
} from './tree-model.ts';

const row = (
  id: string,
  parentId: string | null,
  depth: number,
  extra: Partial<PageTreeItem> = {},
): PageTreeItem => ({ id, parentId, depth, title: id, hasChildren: false, ...extra });

/*
 * a
 * b (open)
 *   b1
 *   b2
 * c (closed, has children)
 * d
 */
const items: PageTreeItem[] = [
  row('a', null, 0),
  row('b', null, 0, { hasChildren: true, expanded: true }),
  row('b1', 'b', 1),
  row('b2', 'b', 1),
  row('c', null, 0, { hasChildren: true }),
  row('d', null, 0),
];

describe('page tree model', () => {
  it('splits a row into before, inside and after by quarters', () => {
    expect(zoneAt(2, 30)).toBe('before');
    expect(zoneAt(15, 30)).toBe('inside');
    expect(zoneAt(28, 30)).toBe('after');
  });

  it('knows a subtree', () => {
    expect(isWithin(items, 'b', 'b2')).toBe(true);
    expect(isWithin(items, 'b', 'b')).toBe(true);
    expect(isWithin(items, 'b2', 'b')).toBe(false);
  });

  it('turns a drop into a move between siblings', () => {
    expect(moveForDrop(items, 'd', 'a', 'after')).toEqual({
      id: 'd',
      parentId: null,
      afterId: 'a',
      beforeId: 'b',
    });
    expect(moveForDrop(items, 'a', 'd', 'before')).toEqual({
      id: 'a',
      parentId: null,
      afterId: 'c',
      beforeId: 'd',
    });
  });

  it('nests on a drop inside, at the end of the open children', () => {
    expect(moveForDrop(items, 'a', 'b', 'inside')).toEqual({
      id: 'a',
      parentId: 'b',
      afterId: 'b2',
      beforeId: null,
    });
    expect(moveForDrop(items, 'a', 'c', 'inside')).toEqual({
      id: 'a',
      parentId: 'c',
      afterId: null,
      beforeId: null,
    });
  });

  it('puts a page dropped below an open parent first among its children', () => {
    expect(moveForDrop(items, 'd', 'b', 'after')).toEqual({
      id: 'd',
      parentId: 'b',
      afterId: null,
      beforeId: 'b1',
    });
  });

  it('refuses drops onto itself, into its subtree and to where it is', () => {
    expect(moveForDrop(items, 'b', 'b', 'inside')).toBeNull();
    expect(moveForDrop(items, 'b', 'b1', 'after')).toBeNull();
    expect(moveForDrop(items, 'a', 'b', 'before')).toBeNull();
    expect(moveForDrop(items, 'b2', 'b1', 'after')).toBeNull();
    expect(moveForDrop(items, 'b2', 'b', 'inside')).toBeNull();
  });

  it('moves with the keyboard: up, down, in and out', () => {
    expect(moveForKey(items, 'c', 'up')).toEqual({
      id: 'c',
      parentId: null,
      afterId: 'a',
      beforeId: 'b',
    });
    expect(moveForKey(items, 'a', 'down')).toEqual({
      id: 'a',
      parentId: null,
      afterId: 'b',
      beforeId: 'c',
    });
    expect(moveForKey(items, 'c', 'indent')).toEqual({
      id: 'c',
      parentId: 'b',
      afterId: 'b2',
      beforeId: null,
    });
    expect(moveForKey(items, 'b1', 'outdent')).toEqual({
      id: 'b1',
      parentId: null,
      afterId: 'b',
      beforeId: 'c',
    });
    expect(moveForKey(items, 'a', 'up')).toBeNull();
    expect(moveForKey(items, 'a', 'indent')).toBeNull();
    expect(moveForKey(items, 'a', 'outdent')).toBeNull();
    expect(moveForKey(items, 'd', 'down')).toBeNull();
  });

  it('walks focus as the WAI-ARIA tree pattern says', () => {
    expect(focusForKey(items, 'a', 'ArrowDown')).toEqual({ focus: 'b' });
    expect(focusForKey(items, 'b', 'ArrowRight')).toEqual({ focus: 'b1' });
    expect(focusForKey(items, 'c', 'ArrowRight')).toEqual({ toggle: true });
    expect(focusForKey(items, 'b', 'ArrowLeft')).toEqual({ toggle: false });
    expect(focusForKey(items, 'b2', 'ArrowLeft')).toEqual({ focus: 'b' });
    expect(focusForKey(items, 'b2', 'Home')).toEqual({ focus: 'a' });
    expect(focusForKey(items, 'a', 'End')).toEqual({ focus: 'd' });
    expect(focusForKey(items, 'a', 'ArrowUp')).toEqual({});
    expect(focusForKey(items, 'a', 'x')).toBeNull();
  });

  it('jumps to the next title by its first letter, wrapping', () => {
    expect(rowForLetter(items, 'd', 'b')).toBe('b');
    expect(rowForLetter(items, 'b', 'b')).toBe('b1');
    expect(rowForLetter(items, 'a', 'z')).toBeNull();
  });
});
