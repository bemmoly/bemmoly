import { ApiError } from '@bemmoly/api-client';
import type { BoardView } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { api, workKeys } from '../shared/index.ts';
import {
  applyMove,
  placementOf,
  revertMove,
  type CardPlacement,
  type MovePlan,
} from './board-drag.ts';

/*
 * A drop, optimistically: the card moves in every cached view holding it in the same frame,
 * then the transition (when the column changes) and the rank are sent. The server is the
 * authority, so the board is refetched once the last move settles; a refusal puts back that
 * card alone and says why.
 */

interface Moving {
  plan: MovePlan;
  /** The card's place in each cached view before the drop, to put back on a refusal. */
  before: Array<[QueryKey, CardPlacement]>;
}

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
  const mutationKey = useMemo(() => workKeys.boardMove(boardId), [boardId]);
  const mutation = useMutation<void, unknown, Moving>({
    mutationKey,
    mutationFn: ({ plan }) => send(plan),
    onError: (error, { plan, before }) => {
      for (const [key, placement] of before) {
        queryClient.setQueryData<BoardView>(key, (view) =>
          view ? revertMove(view, plan, placement) : view,
        );
      }
      toast.show({
        tone: 'warn',
        title: `${plan.key} stays in ${columnName(plan.fromColumnId)}`,
        body: refusalOf(error),
      });
    },
    // The issue's own reads go too: its transitions depend on the status it just left. The
    // board is read again only once the last pending move settles: a view fetched while
    // others are in flight lacks them, and would put their cards back until they land.
    onSettled: async (_data, _error, { plan }) => {
      await queryClient.invalidateQueries({ queryKey: workKeys.issue(plan.key) });
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: viewsKey }),
        queryClient.invalidateQueries({ queryKey: workKeys.boardMetrics(boardId) }),
      ]);
    },
  });

  const move = useCallback(
    (plan: MovePlan) => {
      void queryClient.cancelQueries({ queryKey: viewsKey });
      const before: Moving['before'] = [];
      for (const [key, data] of queryClient.getQueriesData<BoardView>({ queryKey: viewsKey })) {
        const placement = data ? placementOf(data, plan.issueId) : null;
        if (!data || !placement) continue;
        before.push([key, placement]);
        queryClient.setQueryData<BoardView>(key, applyMove(data, plan));
      }
      mutation.mutate({ plan, before });
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
