import { topicOf } from '@bemmoly/module-pipelines/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pipelinesKeys } from '../../api/pipelines.ts';
import { useStream } from '../../hooks/use-stream.ts';
import { api } from '../../lib/api.ts';

const FINISHED = new Set(['passed', 'failed', 'cancelled', 'skipped']);

/** A run, its graph, kept current by the run's topic while it is not finished. */
export function useRun(id: string) {
  const client = useQueryClient();
  const run = useQuery({ queryKey: pipelinesKeys.run(id), queryFn: () => api.pipelines.run(id) });
  const graph = useQuery({
    queryKey: pipelinesKeys.runGraph(id),
    queryFn: () => api.pipelines.runGraph(id),
  });
  const live = run.data ? !FINISHED.has(run.data.state) : true;
  useStream(live ? [topicOf.run(id)] : [], () => {
    void client.invalidateQueries({ queryKey: pipelinesKeys.run(id) });
  });
  return { run, graph };
}
