import { queryKeys } from '@bemmoly/api-client';

/**
 * Every Docs query key, nested under the api-client's `docs` root so one
 * docs.* realtime event can invalidate all of them. The second element names
 * the group so a group can be invalidated on its own.
 */
export const docsKeys = {
  all: () => queryKeys.docs(),
  spaces: () => [...queryKeys.docs(), 'spaces'] as const,
  space: (ref: string) => [...queryKeys.docs(), 'space', ref] as const,
  tree: (spaceRef: string, parentId: string | null) =>
    [...queryKeys.docs(), 'tree', spaceRef, parentId] as const,
  /** Every tree level of a space, for a move that touches several. */
  spaceTree: (spaceRef: string) => [...queryKeys.docs(), 'tree', spaceRef] as const,
  /** One level of the sidebar tree, read whole rather than a page at a time. */
  treeLevel: (spaceRef: string, parentId: string | null) =>
    [...queryKeys.docs(), 'tree', spaceRef, parentId, 'level'] as const,
  page: (pageId: string) => [...queryKeys.docs(), 'page', pageId] as const,
  recent: (mine = false) => [...queryKeys.docs(), 'recent', { mine }] as const,
  starred: () => [...queryKeys.docs(), 'starred'] as const,
  attention: () => [...queryKeys.docs(), 'attention'] as const,
  templates: (spaceId: string | null) => [...queryKeys.docs(), 'templates', spaceId] as const,
  trash: (spaceRef: string) => [...queryKeys.docs(), 'trash', spaceRef] as const,
  spaceSearch: (spaceId: string, q: string) =>
    [...queryKeys.docs(), 'space-search', spaceId, q] as const,
  people: () => [...queryKeys.docs(), 'people'] as const,
};
