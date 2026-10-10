import type { PageSummary } from '@bemmoly/module-docs/shared';
import { describe, expect, it } from 'vitest';
import { summary } from '../test-support.tsx';
import { moveInLevels, removeFromLevels, renameInLevels, type TreeLevels } from './tree-cache.ts';

const page = (title: string, extra: Record<string, unknown> = {}) =>
  summary(title, extra) as PageSummary;

function levels() {
  const a = page('A');
  const b = page('B', { hasChildren: true });
  const b1 = page('B1', { parentId: b.id, depth: 1 });
  const c = page('C');
  const map: TreeLevels = new Map([
    [null, [a, b, c]],
    [b.id, [b1]],
  ]);
  return { map, a, b, b1, c };
}

const titles = (map: TreeLevels, parent: string | null) =>
  (map.get(parent) ?? []).map((row) => row.title);

describe('the sidebar tree cache', () => {
  it('reorders a page among its siblings', () => {
    const { map, a, c } = levels();
    const next = moveInLevels(map, { id: c.id, parentId: null, afterId: null, beforeId: a.id });
    expect(titles(next, null)).toEqual(['C', 'A', 'B']);
    expect(titles(map, null)).toEqual(['A', 'B', 'C']);
  });

  it('moves a page under another and keeps the flags true', () => {
    const { map, a, b, b1 } = levels();
    const next = moveInLevels(map, { id: a.id, parentId: b.id, afterId: b1.id, beforeId: null });
    expect(titles(next, null)).toEqual(['B', 'C']);
    expect(titles(next, b.id)).toEqual(['B1', 'A']);
    expect(next.get(b.id)?.[1]?.parentId).toBe(b.id);
  });

  it('clears the old parent flag when its last child leaves', () => {
    const { map, b, b1 } = levels();
    const next = moveInLevels(map, { id: b1.id, parentId: null, afterId: null, beforeId: null });
    expect(titles(next, null)).toEqual(['A', 'B', 'C', 'B1']);
    expect(next.get(null)?.find((row) => row.id === b.id)?.hasChildren).toBe(false);
  });

  it('marks a closed new parent as having children without loading its level', () => {
    const { map, a, c } = levels();
    const next = moveInLevels(map, { id: a.id, parentId: c.id, afterId: null, beforeId: null });
    expect(next.has(c.id)).toBe(false);
    expect(next.get(null)?.find((row) => row.id === c.id)?.hasChildren).toBe(true);
  });

  it('renames and removes in place', () => {
    const { map, b, b1 } = levels();
    expect(titles(renameInLevels(map, b1.id, 'Services'), b.id)).toEqual(['Services']);
    const gone = removeFromLevels(map, b1.id);
    expect(titles(gone, b.id)).toEqual([]);
    expect(gone.get(null)?.find((row) => row.id === b.id)?.hasChildren).toBe(false);
  });
});
