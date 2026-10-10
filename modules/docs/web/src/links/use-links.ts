import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * The page's place in the reference graph: what it points at (issues it references), what
 * points at it from other modules ("Referenced in") and from other pages (backlinks). The
 * server filters each to what the person may open; with Work disabled, records are absent.
 * docs.links events refetch them in every open tab.
 */

const FRESH = 30_000;

export function useOutgoingLinks(pageId: string) {
  return useQuery({
    queryKey: docsKeys.links(pageId),
    queryFn: () => api.docs.links.outgoing(pageId),
    staleTime: FRESH,
    select: (data) => data.items,
  });
}

export function useBacklinks(pageId: string) {
  return useQuery({
    queryKey: docsKeys.backlinks(pageId),
    queryFn: () => api.docs.links.backlinks(pageId),
    staleTime: FRESH,
    select: (data) => data.items,
  });
}

export function usePageReferences(pageId: string) {
  return useQuery({
    queryKey: docsKeys.pageReferences(pageId),
    queryFn: () => api.docs.links.references(pageId),
    staleTime: FRESH,
    select: (data) => data.items,
  });
}
