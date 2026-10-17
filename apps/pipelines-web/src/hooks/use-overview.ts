import { useQuery } from '@tanstack/react-query';
import { pipelinesKeys } from '../api/pipelines.ts';
import { api } from '../lib/api.ts';

/** For you's header numbers and the live counter for a scope: one request. */
export function useOverview(scope: string) {
  return useQuery({
    queryKey: pipelinesKeys.overview(scope),
    queryFn: () => api.pipelines.overview(scope),
  });
}
