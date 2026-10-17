import { queryKeys } from '@bemmoly/api-client';
import type { ImportJob, ImportPersonOverride, ImportPersonRow } from '@bemmoly/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { importsApi } from '../lib/imports-api.ts';
import type { ImportPlanUpdate } from './use-import-plan-update.ts';
import { useUserSearch } from './use-user-search.ts';

const PAGE = 50;
/** People shown before "Review all": the first, who may need a hand. */
export const PEOPLE_PREVIEW = 3;

/** The picker's value for a person: their member, or "placeholder". */
export const personValue = (row: ImportPersonRow): string => row.userId ?? 'placeholder';

/**
 * The people the plan found, those who may need a hand first (hidden, then placeholders),
 * a page at a time; a choice for one is sent at once and the plan's numbers follow.
 */
export function useImportPeople(job: ImportJob, update: ImportPlanUpdate) {
  const [expanded, setExpanded] = useState(false);
  const search = useUserSearch({ status: 'active' });
  const list = useInfiniteQuery({
    queryKey: queryKeys.imports.people(job.id),
    queryFn: ({ pageParam }) =>
      importsApi.people(job.id, { limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
  });
  const rows = (list.data?.pages ?? []).flatMap((page) => page.items);
  return {
    summary: job.plan?.people ?? null,
    rows: expanded ? rows : rows.slice(0, PEOPLE_PREVIEW),
    loading: list.isPending,
    error: list.error,
    expanded,
    toggle: () => setExpanded((open) => !open),
    hasMore: expanded && Boolean(list.hasNextPage),
    loadingMore: list.isFetchingNextPage,
    loadMore: () => void list.fetchNextPage(),
    search,
    choose: (row: ImportPersonRow, choice: ImportPersonOverride) =>
      update.mutate({ people: { [row.sourceId]: choice } }),
  };
}

export type ImportPeople = ReturnType<typeof useImportPeople>;
