import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * The reads the Docs screens make, one hook each. Lists the tree and home
 * page through keyset cursors are infinite queries, so a long space loads a
 * level 50 rows at a time and a screen asks for more as it scrolls.
 */

const TREE_PAGE = 50;
const HOME_PAGE = 20;

export function useSpaces() {
  return useQuery({
    queryKey: docsKeys.spaces(),
    queryFn: () => api.docs.spaces.list({ limit: 200 }),
    select: (page) => page.items,
  });
}

export function useSpace(spaceRef: string | undefined) {
  return useQuery({
    queryKey: docsKeys.space(spaceRef ?? ''),
    queryFn: () => api.docs.spaces.get(spaceRef ?? ''),
    enabled: Boolean(spaceRef),
  });
}

/** One level of a space's tree: the roots, or the children of `parentId`. */
export function useTreeChildren(spaceRef: string | undefined, parentId: string | null = null) {
  return useInfiniteQuery({
    queryKey: docsKeys.tree(spaceRef ?? '', parentId),
    queryFn: ({ pageParam }) =>
      api.docs.spaces.tree(spaceRef ?? '', {
        limit: TREE_PAGE,
        ...(parentId ? { parentId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: Boolean(spaceRef),
  });
}

export function usePage(pageId: string | undefined) {
  return useQuery({
    queryKey: docsKeys.page(pageId ?? ''),
    queryFn: () => api.docs.pages.get(pageId ?? ''),
    enabled: Boolean(pageId),
  });
}

export function useRecentPages(mine = false) {
  return useInfiniteQuery({
    queryKey: docsKeys.recent(mine),
    queryFn: ({ pageParam }) =>
      api.docs.home.recent({ limit: HOME_PAGE, mine, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useStarredPages() {
  return useInfiniteQuery({
    queryKey: docsKeys.starred(),
    queryFn: ({ pageParam }) =>
      api.docs.home.starred({ limit: HOME_PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** The org templates plus, with a space, that space's own. */
export function useTemplates(spaceId?: string) {
  return useQuery({
    queryKey: docsKeys.templates(spaceId ?? null),
    queryFn: () => api.docs.templates.list(spaceId ? { spaceId } : {}),
  });
}
