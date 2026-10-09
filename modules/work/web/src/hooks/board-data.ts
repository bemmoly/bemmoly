import { queryKeys } from '@bemmoly/api-client';
import type { BoardViewQuery } from '@bemmoly/module-work/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api, useProject, useWorkRealtime, workKeys } from '../shared/index.ts';

/*
 * Everything the Board screen reads, one query each and none fanned out per card: the project,
 * its board, the view (and the filtered view while a server filter is on), the metrics, and
 * the vocabularies the cards and the filter bar print names from.
 */

const PEOPLE = { limit: 100 } as const;

export function useBoardData(projectKey: string | undefined) {
  const { project, isPending: projectPending } = useProject(projectKey);
  const projectId = project?.id;
  const boards = useQuery({
    queryKey: workKeys.boards(projectId ?? ''),
    queryFn: () => api.work.boards.list(projectId ?? ''),
    enabled: Boolean(projectId),
  });
  const board = boards.data?.[0];
  const boardId = board?.id ?? '';
  const scope: BoardViewQuery = {};
  const view = useQuery({
    queryKey: workKeys.boardView(boardId, scope),
    queryFn: ({ signal }) => api.work.boards.view(boardId, scope, { signal }),
    enabled: Boolean(board),
  });
  const metrics = useQuery({
    queryKey: workKeys.boardMetrics(boardId),
    queryFn: () => api.work.boards.metrics(boardId),
    enabled: Boolean(board),
  });
  const sprints = useQuery({
    queryKey: workKeys.sprints(projectId ?? ''),
    queryFn: async () => (await api.work.sprints.list(projectId ?? '')).items,
    enabled: project?.method === 'scrum',
  });
  const workflows = useQuery({
    queryKey: workKeys.workflows(projectId ?? ''),
    queryFn: () => api.work.projectWorkflows.list(projectId ?? ''),
    enabled: Boolean(projectId),
  });
  const issueTypes = useQuery({
    queryKey: workKeys.issueTypes(projectId ?? ''),
    queryFn: () => api.work.issueTypes.list(projectId ?? ''),
    enabled: Boolean(projectId),
  });
  const labels = useQuery({
    queryKey: workKeys.labels(projectId ?? ''),
    queryFn: () => api.work.labels.list(projectId ?? ''),
    enabled: Boolean(projectId),
    retry: false,
  });
  const people = useQuery({
    queryKey: queryKeys.users.list(PEOPLE),
    /** The page as the shell and the Backlog cache it under the same key, never a bare list. */
    queryFn: () => api.users.list(PEOPLE),
    retry: false,
  });
  const me = useQuery({ queryKey: queryKeys.me(), queryFn: () => api.auth.me() });
  useWorkRealtime(projectId);

  const sprintId = view.data?.sprintId ?? null;
  return {
    project,
    board,
    view: view.data,
    metrics: metrics.data,
    sprint: sprints.data?.find((sprint) => sprint.id === sprintId),
    workflow: workflows.data?.[0],
    issueTypes: issueTypes.data ?? [],
    labels: labels.data ?? [],
    people: people.data?.items ?? [],
    meId: me.data?.user.id,
    isPending:
      projectPending ||
      (Boolean(projectId) && boards.isPending) ||
      (Boolean(board) && view.isPending),
    error: boards.error ?? view.error,
    refetch: () => void view.refetch(),
  };
}

export type BoardData = ReturnType<typeof useBoardData>;

/** The ids a server filter keeps, from the filtered view; undefined while none is on. */
export function useBoardMatching(boardId: string | undefined, q: string) {
  const scope: BoardViewQuery = { q };
  const filtered = useQuery({
    queryKey: workKeys.boardView(boardId ?? '', scope),
    queryFn: ({ signal }) => api.work.boards.view(boardId ?? '', scope, { signal }),
    enabled: Boolean(boardId) && q !== '',
    placeholderData: keepPreviousData,
    retry: false,
  });
  const cards = q !== '' ? filtered.data?.cards : undefined;
  const matching = useMemo(
    () => (cards ? new Set(cards.map((card) => card.issueId)) : undefined),
    [cards],
  );
  return { matching, error: q !== '' ? filtered.error : null };
}
