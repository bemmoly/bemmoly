import type { PageSummary } from '@bemmoly/module-docs/shared';
import type { PageTreeMove } from '@bemmoly/ui';

/** The loaded levels of one space's tree: parent id (null for the roots) → children in order. */
export type TreeLevels = Map<string | null, PageSummary[]>;

function withFlag(levels: TreeLevels, pageId: string | null, hasChildren: boolean) {
  if (!pageId) return;
  for (const [parent, rows] of levels) {
    const index = rows.findIndex((row) => row.id === pageId);
    if (index >= 0) {
      const next = [...rows];
      next[index] = { ...rows[index], hasChildren } as PageSummary;
      levels.set(parent, next);
      return;
    }
  }
}

function insertAt(rows: PageSummary[], page: PageSummary, move: PageTreeMove): PageSummary[] {
  const after = move.afterId ? rows.findIndex((row) => row.id === move.afterId) : -1;
  const before = move.beforeId ? rows.findIndex((row) => row.id === move.beforeId) : -1;
  const index = after >= 0 ? after + 1 : before >= 0 ? before : rows.length;
  return [...rows.slice(0, index), page, ...rows.slice(index)];
}

/**
 * The tree as it will be once a move lands, for the optimistic paint: the page leaves its
 * level and joins the new one between its neighbours, and both parents' "has children"
 * flags follow. A destination level that is not loaded yet is left alone; the parent is
 * marked as having children so it can be opened, and the refetch fills it in.
 */
export function moveInLevels(levels: TreeLevels, move: PageTreeMove): TreeLevels {
  const next: TreeLevels = new Map(levels);
  let page: PageSummary | undefined;
  for (const [parent, rows] of levels) {
    const found = rows.find((row) => row.id === move.id);
    if (!found) continue;
    page = found;
    const rest = rows.filter((row) => row.id !== move.id);
    next.set(parent, rest);
    if (rest.length === 0) withFlag(next, parent, false);
    break;
  }
  if (!page) return levels;
  const moved: PageSummary = { ...page, parentId: move.parentId };
  const target = next.get(move.parentId);
  if (target) next.set(move.parentId, insertAt(target, moved, move));
  withFlag(next, move.parentId, true);
  return next;
}

/** A renamed page in whichever level holds it. */
export function renameInLevels(levels: TreeLevels, pageId: string, title: string): TreeLevels {
  const next: TreeLevels = new Map(levels);
  for (const [parent, rows] of levels) {
    if (rows.some((row) => row.id === pageId)) {
      next.set(
        parent,
        rows.map((row) => (row.id === pageId ? { ...row, title } : row)),
      );
    }
  }
  return next;
}

/** A page (and so its subtree) gone from the tree, as a move to the trash paints it. */
export function removeFromLevels(levels: TreeLevels, pageId: string): TreeLevels {
  const next: TreeLevels = new Map(levels);
  for (const [parent, rows] of levels) {
    if (!rows.some((row) => row.id === pageId)) continue;
    const rest = rows.filter((row) => row.id !== pageId);
    next.set(parent, rest);
    if (rest.length === 0) withFlag(next, parent, false);
  }
  return next;
}
