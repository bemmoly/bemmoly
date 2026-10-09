import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workSettingsKeys, workWorkflowKeys } from '../api/index.ts';
import type { StatusInfo } from '../settings/model/columns.ts';
import { adoptOrgConfig, boardConfigDiff } from '../settings/model/diff.ts';
import { settingsCatalog } from '../settings/model/lql.ts';
import type { BoardDraft } from '../settings/model/sections.ts';
import { api, useProject } from '../shared/index.ts';

/**
 * Everything Board settings read: the project and its board, the org default
 * board it is compared with, the workflow's statuses with their issue counts,
 * and the project's fields for LQL. Counts are optional; without them the
 * page still edits, it only cannot say how many cards a change hides.
 */
export function useBoardSettingsData(projectKey: string | undefined) {
  const projectContext = useProject(projectKey);
  const { project } = projectContext;
  const projectId = project?.id ?? '';
  const enabled = Boolean(project);

  const boards = useQuery({
    queryKey: workSettingsKeys.boards(projectId),
    queryFn: () => api.work.boards.list(projectId),
    enabled,
  });
  const orgBoards = useQuery({
    queryKey: workSettingsKeys.orgBoards(),
    queryFn: () => api.work.boards.listOrg(),
  });
  const workflows = useQuery({
    queryKey: workWorkflowKeys.list(projectId),
    queryFn: () => api.work.workflows.list(projectId),
    enabled,
  });
  const orgWorkflows = useQuery({
    queryKey: workSettingsKeys.orgWorkflows(),
    queryFn: () => api.work.orgWorkflows.list(),
  });
  const workflow = workflows.data?.[0];
  const counts = useQuery({
    queryKey: workWorkflowKeys.counts(workflow?.id ?? ''),
    queryFn: () => api.work.workflows.statusCounts(workflow?.id ?? ''),
    enabled: Boolean(workflow),
    retry: false,
  });
  const fields = useQuery({
    queryKey: workSettingsKeys.fields(projectId),
    queryFn: () => api.work.fields.list(projectId),
    enabled,
  });

  const board = boards.data?.[0];
  const orgBoard = orgBoards.data?.[0];

  const statuses = useMemo<StatusInfo[]>(
    () =>
      [...(workflow?.statuses ?? [])]
        .sort((a, b) => a.position - b.position)
        .map(({ id, name, category, color }) => ({ id, name, category, color })),
    [workflow],
  );

  const derived = useMemo(() => {
    const names = new Map<string, string>();
    for (const flow of orgWorkflows.data ?? [])
      for (const status of flow.statuses) names.set(status.id, status.name);
    for (const status of statuses) names.set(status.id, status.name);
    const statusName = (id: string) => names.get(id) ?? 'Unknown status';
    const orgConfig =
      orgBoard && statuses.length > 0
        ? adoptOrgConfig(orgBoard.config, statusName, statuses)
        : null;
    const overrides =
      orgConfig && board ? boardConfigDiff(orgConfig, board.config, statusName) : [];
    return { statusName, orgConfig, overrides };
  }, [orgWorkflows.data, statuses, orgBoard, board]);

  const stored = useMemo<BoardDraft | null>(
    () => (board && project ? { config: board.config, method: project.method } : null),
    [board, project],
  );
  const catalog = useMemo(() => settingsCatalog(fields.data), [fields.data]);

  return {
    project,
    board,
    orgBoard,
    workflow,
    stored,
    statuses,
    counts: counts.data ?? {},
    hasCounts: counts.isSuccess,
    catalog,
    ...derived,
    isPending: projectContext.isPending || boards.isPending || workflows.isPending,
    error: boards.error ?? workflows.error ?? null,
    projectMissing: !projectContext.isPending && !project,
  };
}

export type BoardSettingsData = ReturnType<typeof useBoardSettingsData>;
