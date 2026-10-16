import { topicOf, type ListRunsQuery, type RunState } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

const PAGE = 50;

export type RunFilter = 'all' | 'active' | 'failed' | 'passed';

export const RUN_FILTERS: Record<RunFilter, RunState[] | undefined> = {
  all: undefined,
  active: ['queued', 'running', 'waiting'],
  failed: ['failed'],
  passed: ['passed'],
};

/**
 * Runs newest first, a keyset page at a time. The live counter's events mean runs started or
 * finished somewhere; while the person is looking at the top, the first page is read again.
 */
export function useRuns(query: Partial<ListRunsQuery>) {
  const client = useQueryClient();
  const key = pipelinesKeys.runs({ ...query, limit: PAGE });
  const runs = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      api.pipelines.runs({ ...query, limit: PAGE, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const onePage = (runs.data?.pages.length ?? 0) <= 1;
  useStream(onePage ? [topicOf.live()] : [], () => {
    void client.invalidateQueries({ queryKey: key, exact: true });
  });
  return runs;
}
