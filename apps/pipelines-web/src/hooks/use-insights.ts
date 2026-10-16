import type { InsightsQuery } from '@bemmoly/module-pipelines/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { platformKeys } from '../api/platform.ts';
import { api } from '../lib/api.ts';

/** Insights for a scope and range: one request, kept on screen while the next one loads. */
export function useInsights(query: InsightsQuery) {
  return useQuery({
    queryKey: platformKeys.insights(query),
    queryFn: () => api.platform.insights(query),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}
