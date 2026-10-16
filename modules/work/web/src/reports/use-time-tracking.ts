import { useQuery } from '@tanstack/react-query';
import { api, workKeys } from '../shared/index.ts';

/** The time tracking report over the screen's flow range. */
export function useTimeTracking(projectKey: string, days: number) {
  return useQuery({
    queryKey: workKeys.timeTrackingReport(projectKey, days, null),
    queryFn: ({ signal }) => api.work.reportTimeTracking.get(projectKey, { days }, { signal }),
    enabled: Boolean(projectKey),
  });
}
