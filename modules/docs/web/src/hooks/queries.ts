import type { Space, SpacesPage } from '@bemmoly/module-docs/shared';
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

/** The server's largest page, and a ceiling of pages no real workspace reaches. */
const SPACES_PAGE = 200;
const MOST_SPACE_PAGES = 25;

/**
 * Every space this person can see, page after page: the sidebar, the home and each space's
 * screens find their space in it, so one cut off after the first page would leave a busy
 * workspace's newest spaces out of the sidebar.
 */
export async function listEverySpace(): Promise<Space[]> {
  const items: Space[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MOST_SPACE_PAGES; page += 1) {
    const next: SpacesPage = await api.docs.spaces.list({
      limit: SPACES_PAGE,
      ...(cursor ? { cursor } : {}),
    });
    items.push(...next.items);
    cursor = next.nextCursor;
    if (!cursor) break;
  }
  return items;
}

export function useSpaces() {
  return useQuery({
    queryKey: docsKeys.spaces(),
    queryFn: () => listEverySpace(),
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
