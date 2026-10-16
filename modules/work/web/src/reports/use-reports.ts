import { useQuery } from '@tanstack/react-query';
import { api, useProject, workKeys } from '../shared/index.ts';
import { useSearchParam } from '../shared/url-state.ts';
import { isRange, reportableSprints, type ReportRange } from './model.ts';

/*
 * The Reports screen's reads: the project, its sprints, the chosen sprint's report and the
 * project's flow series. The sprint and the range live in the address.
 */
export function useReports(projectKey: string | undefined) {
  const { project, isPending: projectPending } = useProject(projectKey);
  const rangeParam = useSearchParam('range');
  const range: ReportRange = isRange(rangeParam) ? rangeParam : '30';
  const sprintParam = useSearchParam('sprint');
  const key = project?.key ?? '';
  const projectId = project?.id ?? '';

  const sprintList = useQuery({
    queryKey: workKeys.sprints(projectId),
    queryFn: async () => (await api.work.sprints.list(projectId)).items,
    enabled: Boolean(projectId),
  });
  const sprints = reportableSprints(sprintList.data ?? []);
  const sprint = sprints.find((item) => item.id === sprintParam) ?? sprints[0];

  const sprintReport = useQuery({
    queryKey: workKeys.sprintReport(sprint?.id ?? ''),
    queryFn: ({ signal }) => api.work.reports.sprint(sprint?.id ?? '', { signal }),
    enabled: Boolean(sprint),
  });
  const days = Number(range);
  const flow = useQuery({
    queryKey: workKeys.flowReport(key, days),
    queryFn: ({ signal }) => api.work.reports.flow(key, { days }, { signal }),
    enabled: Boolean(key),
  });

  const pending =
    projectPending ||
    (Boolean(projectId) && sprintList.isPending) ||
    (Boolean(key) && flow.isPending) ||
    (Boolean(sprint) && sprintReport.isPending);
  const error = sprintList.error ?? flow.error ?? sprintReport.error;
  const retry = () => {
    void sprintList.refetch();
    void flow.refetch();
    void sprintReport.refetch();
  };
  return {
    project,
    range,
    sprints,
    sprint,
    sprintReport: sprintReport.data,
    flow: flow.data,
    pending,
    error,
    retry,
  };
}
