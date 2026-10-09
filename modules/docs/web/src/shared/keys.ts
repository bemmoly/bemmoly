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
  page: (pageId: string) => [...queryKeys.docs(), 'page', pageId] as const,
  recent: (mine = false) => [...queryKeys.docs(), 'recent', { mine }] as const,
  starred: () => [...queryKeys.docs(), 'starred'] as const,
  templates: (spaceId: string | null) => [...queryKeys.docs(), 'templates', spaceId] as const,
  trash: (spaceRef: string) => [...queryKeys.docs(), 'trash', spaceRef] as const,
};
