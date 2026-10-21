import type { ScopeKind } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { reportableSprints } from '../reports/model.ts';
import { api, useProject, workKeys } from '../shared/index.ts';

/*
 * Each widget's own read, under the same query keys the Reports screen uses, so a widget and
 * the screen share one cached copy and one realtime invalidation.
 */

/** The widget's sprint (or the active, else latest started one) and its report. */
export function useWidgetSprintReport(projectKey: string, sprintId: string | undefined) {
  const { project } = useProject(projectKey);
  const projectId = project?.id ?? '';
  const list = useQuery({
    queryKey: workKeys.sprints(projectId),
    queryFn: async () => (await api.work.sprints.list(projectId)).items,
    enabled: Boolean(projectId),
  });
  const sprints = reportableSprints(list.data ?? []);
  const sprint = sprints.find((item) => item.id === sprintId) ?? sprints[0];
  const report = useQuery({
    queryKey: workKeys.sprintReport(sprint?.id ?? ''),
    queryFn: ({ signal }) => api.work.reports.sprint(sprint?.id ?? '', { signal }),
    enabled: Boolean(sprint),
  });
  return {
    report: report.data,
    error: list.error ?? report.error,
    /** Read, and the project has no started sprint to draw. */
    none: list.isSuccess && !sprint,
  };
}

export function useWidgetFlow(projectKey: string, days: number) {
  return useQuery({
    queryKey: workKeys.flowReport(projectKey, days),
    queryFn: ({ signal }) => api.work.reports.flow(projectKey, { days }, { signal }),
  });
}

export function useWidgetControl(projectKey: string, days: number) {
  return useQuery({
    queryKey: workKeys.cycleReport(projectKey, 'control', days),
    queryFn: ({ signal }) => api.work.reports.control(projectKey, { days }, { signal }),
  });
}

export function useWidgetTimeInStatus(projectKey: string, days: number) {
  return useQuery({
    queryKey: workKeys.cycleReport(projectKey, 'time-in-status', days),
    queryFn: ({ signal }) => api.work.reports.timeInStatus(projectKey, { days }, { signal }),
  });
}

export function useWidgetScope(projectKey: string, kind: ScopeKind, id: string | undefined) {
  return useQuery({
    queryKey: workKeys.scopeReport(projectKey, kind, id ?? null),
    queryFn: ({ signal }) =>
      api.work.reports.scope(projectKey, { kind, ...(id ? { id } : {}) }, { signal }),
  });
}
