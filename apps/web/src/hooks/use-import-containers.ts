import { queryKeys } from '@bemmoly/api-client';
import type { ImportContainerFilter, ImportContainerPage } from '@bemmoly/shared';
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { importsApi } from '../lib/imports-api.ts';
import type { ListedRow } from './import-overlay.ts';
import type { ImportSelection } from './use-import-selection.ts';

export const CONTAINER_PAGE = 100;
/** Rows in view wait this long before they are counted, so a fast scroll asks once. */
export const COUNT_DEBOUNCE_MS = 250;
const COUNT_MAX = 100;
/** Rows just below the view are counted with it, so a short scroll finds them counted. */
const COUNT_AHEAD = 10;
/** The next page is asked for when the view comes this close to the last loaded row. */
const PREFETCH_ROWS = 30;

export type ListedPage = ImportContainerPage & { seq: number };

export interface RowRange {
  start: number;
  end: number;
}

/**
 * One search and filter of the rows a connection found, a page at a time. Each read sends the
 * waiting ticks first and remembers the last one the server had, so the chooser replays only
 * what came after.
 */
export function useImportContainers(
  jobId: string,
  q: string,
  filter: ImportContainerFilter,
  selection: ImportSelection,
) {
  const client = useQueryClient();
  const [range, setRange] = useState<RowRange>({ start: 0, end: 0 });
  const key = queryKeys.imports.containers(jobId, q, filter);
  const list = useInfiniteQuery({
    queryKey: key,
    queryFn: async ({ pageParam }): Promise<ListedPage> => {
      await selection.flush();
      const seq = selection.acked();
      const page = await importsApi.containers(jobId, {
        ...(q ? { q } : {}),
        filter,
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: CONTAINER_PAGE,
      });
      return { ...page, seq };
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.next ?? undefined,
    placeholderData: keepPreviousData,
  });

  const rows = useMemo<ListedRow[]>(
    () =>
      (list.data?.pages ?? []).flatMap((page) =>
        page.items.map((row) => ({ ...row, seq: page.seq })),
      ),
    [list.data],
  );
  const first = list.data?.pages[0];
  const total = first?.view.total ?? 0;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && range.end + PREFETCH_ROWS >= rows.length) {
      void fetchNextPage();
    }
  }, [range.end, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const count = useMutation({
    mutationFn: (ids: string[]) => importsApi.count(jobId, { ids }),
    onSuccess: (result) => {
      const found = new Map(result.items.map((item) => [item.id, item.count]));
      client.setQueriesData<{ pages: ListedPage[]; pageParams: unknown[] }>(
        { queryKey: [...queryKeys.imports.detail(jobId), 'containers'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((row) =>
                found.has(row.id) ? { ...row, count: found.get(row.id) ?? row.count } : row,
              ),
            })),
          },
      );
      void client.invalidateQueries({ queryKey: queryKeys.imports.selection(jobId) });
    },
  });

  // Counts the rows in view that are not counted yet, once each, a moment after they settle.
  const asked = useRef(new Set<string>());
  const { mutate } = count;
  useEffect(() => {
    const ids = rows
      .slice(range.start, range.end + COUNT_AHEAD)
      .filter((row) => row.count === null && row.access === 'ok' && !asked.current.has(row.id))
      .map((row) => row.id)
      .slice(0, COUNT_MAX);
    if (ids.length === 0) return;
    const timer = setTimeout(() => {
      for (const id of ids) asked.current.add(id);
      mutate(ids, {
        onError: () => {
          for (const id of ids) asked.current.delete(id);
        },
      });
    }, COUNT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rows, range, mutate]);

  return {
    rows,
    total,
    view: first?.view,
    counts: first?.counts,
    firstSeq: first?.seq ?? 0,
    loading: list.isPending,
    fetching: list.isFetching,
    error: list.error,
    refetch: () => void list.refetch(),
    range,
    setRange,
  };
}
