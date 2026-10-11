import type { Issue, IssueType, WorkflowStatus } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../shared/api.ts';
import { issueKeys } from './issue-keys.ts';
import { useLabels, useSprints } from './projects-catalog.ts';

const STALE = 5 * 60_000;

/**
 * The project's statuses in board order: its own workflow when it has one, otherwise the
 * workspace default. The first to-do status is where a new issue starts.
 */
export function useCreateStatuses(projectId: string | undefined) {
  const query = useQuery({
    queryKey: issueKeys.statuses(projectId ?? ''),
    queryFn: () => api.work.projectCatalog.workflows(projectId ?? ''),
    enabled: Boolean(projectId),
    staleTime: STALE,
  });
  return useMemo(() => {
    const flows = query.data ?? [];
    const flow = flows.find((item) => item.projectId !== null) ?? flows[0];
    const statuses: WorkflowStatus[] = [...(flow?.statuses ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const initial = statuses.find((status) => status.category === 'todo') ?? statuses[0];
    return { statuses, initial };
  }, [query.data]);
}

/** The project's open epics, to file a new issue under one. */
export function useCreateEpics(projectId: string | undefined, types: readonly IssueType[]) {
  const epicType = types.find((type) => type.level === 'epic');
  const query = useQuery({
    queryKey: [...issueKeys.catalog(projectId ?? '', 'epics')],
    queryFn: async () =>
      (await api.work.issues.list({ projectId, typeId: epicType?.id, limit: 100 })).items,
    enabled: Boolean(projectId && epicType),
    staleTime: 60_000,
  });
  return (query.data ?? []) as Issue[];
}

/** Everything the property chips choose from, for one project. */
export function useCreateOptions(
  projectKey: string | undefined,
  projectId: string | undefined,
  types: readonly IssueType[],
) {
  const labels = useLabels(projectKey);
  const sprints = useSprints(projectKey);
  const { statuses, initial } = useCreateStatuses(projectId);
  const epics = useCreateEpics(projectId, types);
  const openSprints = useMemo(
    () => (sprints.data ?? []).filter((sprint) => sprint.state !== 'closed'),
    [sprints.data],
  );
  return { labels: labels.data ?? [], sprints: openSprints, statuses, initial, epics };
}

export type CreateOptions = ReturnType<typeof useCreateOptions>;
