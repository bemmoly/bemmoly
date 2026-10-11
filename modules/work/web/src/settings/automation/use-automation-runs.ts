import {
  AUTOMATION_RUN_STATUSES,
  type AutomationRun,
  type AutomationRunStatus,
} from '@bemmoly/module-work/shared';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { automationKeys } from '../../api/index.ts';
import { api } from '../../shared/index.ts';
import { setSearchParams, useSearchParam } from '../../shared/url-state.ts';

const PAGE = 25;
/** Queued and running runs are read again this often until they finish. */
const LIVE_MS = 2_000;

export type RunFilter = AutomationRunStatus | 'all';

export const isRunStatus = (value: string | null): value is AutomationRunStatus =>
  (AUTOMATION_RUN_STATUSES as readonly string[]).includes(value ?? '');

/**
 * The run log of a project's rules (and of global rules on its issues): keyset pages, the
 * status filter and the open run in the address, and a quick re-read while any run is live.
 */
export function useAutomationRuns(projectId: string | null, active = true) {
  const statusParam = useSearchParam('status');
  const openId = useSearchParam('run');
  const status: RunFilter = isRunStatus(statusParam) ? statusParam : 'all';
  const query = { projectId: projectId ?? undefined, ...(status === 'all' ? {} : { status }) };
  const log = useInfiniteQuery({
    queryKey: automationKeys.runs(query),
    queryFn: ({ pageParam }) =>
      api.work.automation.runs({
        ...query,
        limit: PAGE,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
    enabled: Boolean(projectId) && active,
    // Runs land from the job queue, not from this screen: opening the log always reads it again.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: (current) => {
      const items = current.state.data?.pages.flatMap((page) => page.items) ?? [];
      return items.some((run) => run.status === 'queued' || run.status === 'running')
        ? LIVE_MS
        : false;
    },
  });
  const runs = useMemo(() => log.data?.pages.flatMap((page) => page.items) ?? [], [log.data]);
  return {
    log,
    runs,
    status,
    setStatus: (next: RunFilter) => setSearchParams({ status: next === 'all' ? null : next }),
    openId,
    open: runs.find((run) => run.id === openId) ?? null,
    setOpen: (run: AutomationRun | null) =>
      setSearchParams({ run: run?.id ?? null }, { push: true }),
  };
}
