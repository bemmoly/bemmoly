import type { PageSummary } from '@bemmoly/module-docs/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { useRecentPages } from './queries.ts';

/** What waits on the person: reviews asked of them, stale pages they own. */
export function useAttention() {
  return useQuery({
    queryKey: docsKeys.attention(),
    queryFn: () => api.docs.home.attention({ limit: 6 }),
  });
}

/** The ids the person has starred, for a Star / Unstar choice in menus. */
export function useStarredIds() {
  const query = useQuery({
    queryKey: [...docsKeys.starred(), 'ids'],
    queryFn: () => api.docs.home.starred({ limit: 100 }),
    staleTime: 30_000,
  });
  return useMemo(() => new Set(query.data?.items.map((page) => page.id)), [query.data]);
}

const DRAFT_STATUSES = new Set(['draft', 'in_review']);
/** Recent pages of the person's are read until this many drafts show, or five pages in. */
const DRAFTS_WANTED = 8;
const DRAFT_PAGES = 5;

/**
 * "Drafts" on the Docs home: the person's own pages still in draft or in review, newest
 * first. It walks their recent pages, so a draft untouched for a long time can fall off
 * the end, as it does from the Recent list.
 */
export function useMyDrafts(enabled: boolean) {
  const mine = useRecentPages(true);
  const pages = mine.data?.pages ?? [];
  const drafts = pages
    .flatMap((page) => page.items)
    .filter((page: PageSummary) => DRAFT_STATUSES.has(page.status));
  const more =
    enabled &&
    mine.hasNextPage &&
    !mine.isFetchingNextPage &&
    drafts.length < DRAFTS_WANTED &&
    pages.length < DRAFT_PAGES;
  useEffect(() => {
    if (more) void mine.fetchNextPage();
  }, [more, mine]);
  return {
    drafts,
    isPending: mine.isPending,
    isError: mine.isError,
    retry: () => void mine.refetch(),
  };
}
