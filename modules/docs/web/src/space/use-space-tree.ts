import type { PageSummary } from '@bemmoly/module-docs/shared';
import type { PageTreeItem } from '@bemmoly/ui';
import { useQueries } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { useOpenIds } from './tree-store.ts';

/** A level is read in pages of this size until it ends, up to LEVEL_CAP rows. */
const LEVEL_PAGE = 100;
const LEVEL_CAP = 1000;

/** One level of the tree, whole: the roots of a space, or the children of a page. */
export async function loadLevel(spaceKey: string, parentId: string | null): Promise<PageSummary[]> {
  const rows: PageSummary[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.docs.spaces.tree(spaceKey, {
      limit: LEVEL_PAGE,
      ...(parentId ? { parentId } : {}),
      ...(cursor ? { cursor } : {}),
    });
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor && rows.length < LEVEL_CAP);
  return rows;
}

export const levelQuery = (spaceKey: string, parentId: string | null) => ({
  queryKey: docsKeys.treeLevel(spaceKey, parentId),
  queryFn: () => loadLevel(spaceKey, parentId),
  staleTime: 30_000,
});

/**
 * The rows the sidebar shows: the roots, and under every open page its
 * children, each level its own query so opening a page loads one level and a
 * move invalidates only what it touched. Levels are discovered as they load:
 * an open page whose parent level has not arrived yet waits for it.
 */
export function useSpaceTree(spaceKey: string) {
  const openIds = useOpenIds(spaceKey);
  const open = useMemo(() => new Set(openIds), [openIds]);
  const parents: (string | null)[] = [null, ...openIds];
  const levels = useQueries({
    queries: parents.map((parentId) => ({
      ...levelQuery(spaceKey, parentId),
      enabled: Boolean(spaceKey),
    })),
  });
  const byParent = new Map(parents.map((parentId, index) => [parentId, levels[index]]));
  const signature = levels.map((level) => `${level.dataUpdatedAt}:${level.status}`).join(',');

  // byParent is rebuilt every render; the levels' update times say when it changed.
  const items = useMemo(() => {
    const rows: PageTreeItem[] = [];
    const walk = (parentId: string | null, depth: number) => {
      for (const page of byParent.get(parentId)?.data ?? []) {
        const expanded = page.hasChildren && open.has(page.id);
        const level = expanded ? byParent.get(page.id) : undefined;
        rows.push({
          id: page.id,
          parentId: page.parentId,
          // From the walk, not the row: a moved page's subtree is re-indented before the refetch.
          depth,
          title: page.title,
          icon: page.icon,
          hasChildren: page.hasChildren,
          expanded,
          loading: expanded && (level?.isPending ?? true),
        });
        if (expanded) walk(page.id, depth + 1);
      }
    };
    walk(null, 0);
    return rows;
  }, [signature, open]);

  const summaries = useMemo(
    () => new Map(levels.flatMap((level) => level.data ?? []).map((page) => [page.id, page])),
    // The levels' update times say when any level changed.
    [signature],
  );

  const roots = levels[0];
  return {
    items,
    /** Every loaded page by id, for what the rows leave out (status, owner, dates). */
    summaries,
    isPending: roots?.isPending ?? true,
    isError: roots?.isError ?? false,
    error: roots?.error ?? null,
    refetch: () => void roots?.refetch(),
  };
}
