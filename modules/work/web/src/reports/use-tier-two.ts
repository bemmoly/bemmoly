import type { ScopeKind } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { api, workKeys } from '../shared/index.ts';
import { useSearchParam } from '../shared/url-state.ts';

/*
 * The reads behind the cycle reports (control chart, time in status), over the flow range,
 * and the epic or version burnup, whose kind and target live in the address.
 */

export function useCycleReports(projectKey: string, days: number) {
  const control = useQuery({
    queryKey: workKeys.cycleReport(projectKey, 'control', days),
    queryFn: ({ signal }) => api.work.reports.control(projectKey, { days }, { signal }),
    enabled: Boolean(projectKey),
  });
  const timeInStatus = useQuery({
    queryKey: workKeys.cycleReport(projectKey, 'time-in-status', days),
    queryFn: ({ signal }) => api.work.reports.timeInStatus(projectKey, { days }, { signal }),
    enabled: Boolean(projectKey),
  });
  return { control, timeInStatus };
}

export const isScopeKind = (value: string | null): value is ScopeKind =>
  value === 'epic' || value === 'version';

export function useScopeReport(projectKey: string) {
  const kindParam = useSearchParam('scope');
  const kind: ScopeKind = isScopeKind(kindParam) ? kindParam : 'epic';
  const target = useSearchParam('target');
  const report = useQuery({
    queryKey: workKeys.scopeReport(projectKey, kind, target),
    queryFn: ({ signal }) =>
      api.work.reports.scope(projectKey, { kind, ...(target ? { id: target } : {}) }, { signal }),
    enabled: Boolean(projectKey),
    placeholderData: (previous) => (previous?.kind === kind ? previous : undefined),
  });
  return { kind, report };
}
