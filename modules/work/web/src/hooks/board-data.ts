import { queryKeys } from '@bemmoly/api-client';
import type { BoardView, BoardViewQuery, Sprint } from '@bemmoly/module-work/shared';
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { api, useProject, useWorkRealtime, workKeys } from '../shared/index.ts';
import { loadedDepth } from './board-pages.ts';

/*
 * Everything the Board screen reads, one query each and none fanned out per card: the project,
 * its board, the view (and the filtered view while a server filter is on), the metrics, and
 * the vocabularies the cards and the filter bar print names from. A view is the first page of
 * every column plus whatever "Load more" added; reading it again keeps that depth.
 */

const PEOPLE = { limit: 100 } as const;
const NO_SPRINTS: readonly Sprint[] = [];

/** The view under `scope`, read again as deep as its deepest column already is. */
export function boardViewQuery(
  client: QueryClient,
  boardId: string,
  scope: Pick<BoardViewQuery, 'q' | 'sprintId'>,
) {
  const queryKey = workKeys.boardView(boardId, scope);
  return {
    queryKey,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.work.boards.view(
        boardId,
        {
          ...(scope.q ? { q: scope.q } : {}),
          ...(scope.sprintId ? { sprintId: scope.sprintId } : {}),
          limit: loadedDepth(client.getQueryData<BoardView>(queryKey)),
        },
        { signal },
      ),
  };
}

/** The project's board, its config before its view: the quick filters' queries live there. */
export function useProjectBoard(projectId: string | undefined) {
  const boards = useQuery({
    queryKey: workKeys.boards(projectId ?? ''),
    queryFn: () => api.work.boards.list(projectId ?? ''),
    enabled: Boolean(projectId),
  });
  return { boards, board: boards.data?.[0] };
}

/**
 * `q` is the server filter (the query bar and the LQL quick filters). While it is on, the board
 * shows the filtered view, paged and counted by the server; until that answers, and when the
 * filter is not valid LQL, it shows the board unfiltered.
 */
export function useBoardData(projectKey: string | undefined, q = '') {
  const client = useQueryClient();
  const { project, isPending: projectPending } = useProject(projectKey);
  const projectId = project?.id;
  const { boards, board } = useProjectBoard(projectId);
  const boardId = board?.id ?? '';
  const view = useQuery({ ...boardViewQuery(client, boardId, {}), enabled: Boolean(board) });
  const filtered = useQuery({
    ...boardViewQuery(client, boardId, { q }),
    enabled: Boolean(board) && q !== '',
    placeholderData: keepPreviousData,
    retry: false,
  });
  const shown = (q !== '' ? filtered.data : undefined) ?? view.data;
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

  const sprintId = shown?.sprintId ?? null;
  return {
    project,
    board,
    view: shown,
    /** The cache entry the board shows, which "Load more" adds to. */
    viewScope: (q !== '' && filtered.data && !filtered.isPlaceholderData
      ? { q }
      : {}) as BoardViewQuery,
    filterError: q !== '' ? filtered.error : null,
    metrics: metrics.data,
    sprint: sprints.data?.find((sprint) => sprint.id === sprintId),
    sprints: sprints.data ?? NO_SPRINTS,
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
