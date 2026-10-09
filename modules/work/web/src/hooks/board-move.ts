import { ApiError } from '@bemmoly/api-client';
import type { BoardView } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api, workKeys } from '../shared/index.ts';
import { applyMove, type MovePlan } from './board-drag.ts';

/*
 * A drop, optimistically: the card moves in every cached view of the board in the same frame,
 * then the transition (when the column changes) and the rank are sent. The server is the
 * authority, so the board is refetched either way; a refusal puts the card back and says why.
 */

type Snapshot = Array<[QueryKey, BoardView | undefined]>;

/** The workflow's reasons when it refused the move, else the error's own sentence. */
export function refusalOf(error: unknown): string {
  if (error instanceof ApiError) {
    const details = error.details as { reasons?: unknown } | undefined;
    const reasons = Array.isArray(details?.reasons) ? details.reasons.map(String) : [];
    return reasons.length > 0 ? reasons.join(' ') : error.message;
  }
  return error instanceof Error ? error.message : 'The move did not go through.';
}

async function send(plan: MovePlan): Promise<void> {
  if (plan.statusId) await api.work.boardIssues.transition(plan.key, plan.statusId);
  if (plan.beforeIssueId || plan.afterIssueId) {
    await api.work.boardIssues.rank(plan.key, {
      beforeIssueId: plan.beforeIssueId,
      afterIssueId: plan.afterIssueId,
    });
  }
}

export function useBoardMove(boardId: string, columnName: (columnId: string) => string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const viewsKey = useMemo(() => workKeys.boardView(boardId).slice(0, -1), [boardId]);
  const mutation = useMutation<void, unknown, { plan: MovePlan; snapshot: Snapshot }>({
    mutationFn: ({ plan }) => send(plan),
    onError: (error, { plan, snapshot }) => {
      for (const [key, data] of snapshot) queryClient.setQueryData(key, data);
      toast.show({
        tone: 'warn',
        title: `${plan.key} stays in ${columnName(plan.fromColumnId)}`,
        body: refusalOf(error),
      });
    },
    // The issue's own reads go too: its transitions depend on the status it just left.
    onSettled: (_data, _error, { plan }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: viewsKey }),
        queryClient.invalidateQueries({ queryKey: workKeys.boardMetrics(boardId) }),
        queryClient.invalidateQueries({ queryKey: workKeys.issue(plan.key) }),
      ]),
  });

  const move = useCallback(
    (plan: MovePlan) => {
      void queryClient.cancelQueries({ queryKey: viewsKey });
      const snapshot = queryClient.getQueriesData<BoardView>({ queryKey: viewsKey });
      for (const [key, data] of snapshot) {
        if (data) queryClient.setQueryData<BoardView>(key, applyMove(data, plan));
      }
      mutation.mutate({ plan, snapshot });
    },
    [queryClient, viewsKey, mutation.mutate],
  );

  /** A drop the workflow refuses before anything is sent: the card never leaves. */
  const refuse = useCallback(
    (key: string, columnId: string, reason: string) =>
      toast.show({
        tone: 'warn',
        title: `${key} cannot move to ${columnName(columnId)}`,
        body: reason,
      }),
    [toast, columnName],
  );

  return { move, refuse, isMoving: mutation.isPending };
}
