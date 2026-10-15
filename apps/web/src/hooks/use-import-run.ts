import { queryKeys } from '@bemmoly/api-client';
import type { ImportContainerRow, ImportJob } from '@bemmoly/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { importsApi } from '../lib/imports-api.ts';
import { IMPORT_POLL_MS, isActive, useImportJob } from './use-imports.ts';

/** Rows per page of the run's list; "Show more" reads the next page. */
export const RUN_ROWS = 100;

export type RunRow = ImportContainerRow & { progress: NonNullable<ImportContainerRow['progress']> };

const ran = (rows: readonly ImportContainerRow[]) =>
  rows.filter((row): row is RunRow => Boolean(row.progress));

/** Failed first, so the one that wants a hand is at the top; the rest in the server's order. */
export function runOrder(rows: readonly ImportContainerRow[]): RunRow[] {
  const run = ran(rows);
  return [
    ...run.filter((row) => row.progress.status === 'failed'),
    ...run.filter((row) => row.progress.status !== 'failed'),
  ];
}

/**
 * The chosen projects or spaces with how each one's run went, read every second while the job
 * runs and once more when it ends. Failed ones come first whatever page they sit on (the
 * server lists them apart); the rest arrive a page at a time through loadMore.
 */
export function useImportRunRows(job: ImportJob) {
  const active = isActive(job.status);
  const key = [...queryKeys.imports.containers(job.id, '', 'run'), job.runs, active];
  const poll = active ? IMPORT_POLL_MS : false;
  const failed = useQuery({
    queryKey: [...key, 'failed'],
    queryFn: () => importsApi.containers(job.id, { filter: 'failed', limit: 200 }),
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
  const others = useInfiniteQuery({
    queryKey: [...key, 'others'],
    queryFn: ({ pageParam }) =>
      importsApi.containers(job.id, {
        filter: 'others',
        limit: RUN_ROWS,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (page) => page.next ?? undefined,
    refetchInterval: poll,
    placeholderData: (previous) => previous,
  });
  const rows = [
    ...ran(failed.data?.items ?? []),
    ...ran(others.data?.pages.flatMap((page) => page.items) ?? []),
  ];
  const total = (failed.data?.view.total ?? 0) + (others.data?.pages[0]?.view.total ?? 0);
  return {
    rows,
    total,
    hasMore: others.hasNextPage,
    loadingMore: others.isFetchingNextPage,
    loadMore: () => void others.fetchNextPage(),
    loading: failed.isPending || others.isPending,
    error: failed.error ?? others.error,
  };
}

interface Sample {
  at: number;
  done: number;
}

/**
 * Whole minutes left at the rate seen so far, or null until there is a rate: the first sample
 * is where this page started watching, so a job opened halfway is not counted from zero.
 */
export function minutesLeft(first: Sample | null, now: Sample, total: number): number | null {
  if (!first || now.at <= first.at || now.done <= first.done) return null;
  const perMs = (now.done - first.done) / (now.at - first.at);
  const left = Math.max(0, total - now.done) / perMs;
  return Math.max(1, Math.round(left / 60_000));
}

/**
 * "about 13 minutes left", from the job's overall progress as this page saw it grow. The clock
 * is when each copy of the job arrived, so the estimate is a pure reading of what was polled.
 */
export function useRunEstimate(job: ImportJob): number | null {
  const { done, total } = job.progress;
  const active = isActive(job.status);
  const at = useImportJob(job.id).dataUpdatedAt;
  const [first, setFirst] = useState<Sample | null>(null);
  // A Retry starts a fresh rate: progress before it says nothing about the pace after.
  if (active && at > 0 && (!first || done < first.done)) setFirst({ at, done });
  return active ? minutesLeft(first, { at, done }, total) : null;
}
