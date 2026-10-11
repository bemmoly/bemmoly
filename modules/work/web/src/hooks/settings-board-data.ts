import { defaultBoardConfig } from '@bemmoly/module-work/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { workSettingsKeys, workWorkflowKeys } from '../api/index.ts';
import type { StatusInfo } from '../settings/model/columns.ts';
import { adoptOrgConfig, boardConfigDiff } from '../settings/model/diff.ts';
import { settingsCatalog } from '../settings/model/lql.ts';
import { orgSettingsPath, type SettingsScope } from '../settings/pages.ts';
import type { BoardDraft } from '../settings/model/sections.ts';
import { workflowPaths } from '../workflow/navigate.ts';
import { api, useProject } from '../shared/index.ts';

/**
 * Everything Board settings read: the board (a project's, or the org default), the default a
 * project's is compared with and resets to, the workflow's statuses with their issue counts, and
 * the fields for LQL. A project's default is the org default board matched to its statuses, else
 * Work's own default board for them, as the server works out what a project inherits. Counts are
 * optional; without them the page still edits, it only cannot say how many cards a change hides.
 * The org default board has no issues of its own, so none.
 */
export function useBoardSettingsData(scope: SettingsScope) {
  const org = scope.kind === 'org';
  const projectContext = useProject(org ? undefined : scope.projectKey);
  const project = org ? undefined : projectContext.project;
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
  /** The list carries the org defaults too; the project's own copy is the one its board maps. */
  const workflow = org
    ? orgWorkflows.data?.find((flow) => flow.projectId === null)
    : (workflows.data?.find((flow) => flow.projectId === projectId) ?? workflows.data?.[0]);
  /** This project's issues only: a workflow shared by several projects counts all of theirs. */
  const counts = useQuery({
    queryKey: workWorkflowKeys.counts(workflow?.id ?? '', projectId),
    queryFn: () => api.work.workflows.statusCounts(workflow?.id ?? '', projectId),
    enabled: Boolean(workflow) && enabled,
    retry: false,
  });
  const fields = useQuery({
    queryKey: workSettingsKeys.fields(org ? null : projectId),
    queryFn: () => api.work.fields.list(org ? null : projectId),
    enabled: org || enabled,
  });

  const orgBoard = orgBoards.data?.[0];
  const board = org ? orgBoard : boards.data?.[0];

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
    // The org default is compared with nothing: it is what projects are compared with.
    const baseConfig =
      org || !orgBoards.isSuccess || statuses.length === 0
        ? null
        : orgBoard
          ? adoptOrgConfig(orgBoard.config, statusName, statuses)
          : defaultBoardConfig(statuses);
    const overrides =
      baseConfig && board ? boardConfigDiff(baseConfig, board.config, statusName) : [];
    return { statusName, baseConfig, overrides };
  }, [org, orgWorkflows.data, statuses, orgBoards.isSuccess, orgBoard, board]);

  const stored = useMemo<BoardDraft | null>(
    () =>
      board && (org || project)
        ? { config: board.config, method: project?.method ?? 'scrum' }
        : null,
    [board, org, project],
  );
  const catalog = useMemo(() => settingsCatalog(fields.data), [fields.data]);

  return {
    scope,
    project,
    board,
    orgBoard,
    /** What the page calls the default: the org's board scheme by name, or Work's own. */
    baseName: orgBoard ? orgBoard.name : 'the default board',
    workflow,
    stored,
    statuses,
    counts: counts.data ?? {},
    hasCounts: counts.isSuccess,
    catalog,
    /** Where the statuses come from, for the Columns tab's "Statuses come from the Workflow". */
    workflowHref: org
      ? orgSettingsPath('workflow')
      : project
        ? workflowPaths.list(project.key)
        : '/work',
    ...derived,
    isPending: org
      ? orgBoards.isPending || orgWorkflows.isPending
      : projectContext.isPending || boards.isPending || workflows.isPending,
    error: org
      ? (orgBoards.error ?? orgWorkflows.error ?? null)
      : (boards.error ?? workflows.error ?? null),
    projectMissing: !org && !projectContext.isPending && !project,
  };
}

export type BoardSettingsData = ReturnType<typeof useBoardSettingsData>;
