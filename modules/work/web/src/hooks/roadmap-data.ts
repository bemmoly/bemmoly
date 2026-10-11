import type { RoadmapQueryInput } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { api, useProject, useWorkRealtime, workKeys } from '../shared/index.ts';

/*
 * What the Roadmap reads: one call for the epics, versions, dependencies and forecasts of the
 * projects in view (one project, or every one the person can open), refreshed by the
 * project's realtime events while one project is shown.
 */

export function useRoadmapData(projectKey: string | undefined) {
  const { project, isPending: projectPending } = useProject(projectKey);
  const oneProject = projectKey !== undefined;
  const query: RoadmapQueryInput = oneProject && project ? { projects: project.key } : {};
  const ready = !oneProject || Boolean(project);
  const view = useQuery({
    queryKey: workKeys.roadmap(query),
    queryFn: ({ signal }) => api.work.roadmap.view(query, { signal }),
    enabled: ready,
  });
  useWorkRealtime(oneProject ? project?.id : undefined);
  return {
    oneProject,
    project,
    view: view.data,
    isPending: (oneProject && projectPending) || (ready && view.isPending),
    error: view.error,
    refetch: () => void view.refetch(),
  };
}

export type RoadmapData = ReturnType<typeof useRoadmapData>;
