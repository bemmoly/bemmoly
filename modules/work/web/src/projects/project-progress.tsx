import type { Project } from '@bemmoly/module-work/shared';
import { ProgressBar, Skeleton } from '@bemmoly/ui';
import { useQuery } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/**
 * Where a project stands, read from its first board's cached metrics: a Scrum project shows its
 * active sprint and the share of the sprint's points done; a Kanban project (or a Scrum one
 * between sprints) shows how many issues are in progress. Archived projects show nothing.
 */
export function useProjectProgress(project: Project) {
  const live = project.archivedAt === null;
  const boards = useQuery({
    queryKey: workKeys.boards(project.id),
    queryFn: () => api.work.boards.list(project.id),
    enabled: live,
    staleTime: 60_000,
  });
  const boardId = boards.data?.[0]?.id;
  const metrics = useQuery({
    queryKey: workKeys.boardMetrics(boardId ?? ''),
    queryFn: () => api.work.boards.metrics(boardId ?? ''),
    enabled: Boolean(boardId),
    staleTime: 60_000,
  });
  const sprints = useQuery({
    queryKey: workKeys.sprints(project.id),
    queryFn: () => api.work.projectCatalog.sprints(project.key),
    enabled: live && project.method === 'scrum',
    staleTime: 60_000,
  });
  const sprint = sprints.data?.find((row) => row.state === 'active') ?? null;
  const data = metrics.data;
  const pending = live && (boards.isPending || (Boolean(boardId) && metrics.isPending));
  const percent =
    data && data.committedPoints > 0
      ? Math.round((data.completedPoints / data.committedPoints) * 100)
      : 0;
  return { live, pending, sprint, metrics: data, percent };
}

/** The Progress cell: a sprint bar with its name and percent, or an in-progress count. */
export function ProjectProgress({ project }: { project: Project }) {
  const { live, pending, sprint, metrics, percent } = useProjectProgress(project);
  if (!live) return <span className="text-12 text-tx-3">Archived</span>;
  if (pending) return <Skeleton width={110} height={8} />;
  if (sprint && metrics) {
    return (
      <span
        className="flex min-w-0 items-center gap-2"
        title={`${metrics.completedPoints} of ${metrics.committedPoints} points done`}
      >
        <ProgressBar
          value={percent}
          size="xs"
          fillClassName="bg-done"
          className="w-16"
          label={`${sprint.name} progress`}
        />
        <span className="truncate text-12 text-tx-3 tabular-nums">
          {percent}% · {sprint.name}
        </span>
      </span>
    );
  }
  if (!metrics) return <span className="text-12 text-tx-3">No board yet</span>;
  return (
    <span className="text-12 text-tx-3 tabular-nums">
      {metrics.wipCount === 0 ? 'Nothing in progress' : `${metrics.wipCount} in progress`}
    </span>
  );
}
