import type { Backlog } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { backlogKeys } from '../api/index.ts';
import { planMove, reconcileIssue, type DropTarget, type MovePlan } from '../backlog/move.ts';
import { planning } from './backlog-client.ts';

/**
 * Drops issues: the planned backlog is painted at once, the calls go one at
 * a time with each server answer written over its provisional copy, and the
 * read is refetched when the last one lands. Moves share one mutation scope,
 * so a second drop waits for the first instead of racing it. A failure puts
 * the backlog back and says why.
 */
export function useMoveIssues(projectKey: string) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  const key = backlogKeys.backlog(projectKey);

  const mutation = useMutation({
    scope: { id: `backlog-move:${projectKey}` },
    mutationFn: async (plan: MovePlan) => {
      for (const call of plan.calls) {
        const issue = await planning.move(call.key, call.body);
        queryClient.setQueryData<Backlog>(key, (data) =>
          data ? reconcileIssue(data, issue) : data,
        );
      }
    },
    onMutate: async (plan: MovePlan) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Backlog>(key);
      queryClient.setQueryData(key, plan.backlog);
      return { previous };
    },
    onError: (error, _plan, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
      show({ tone: 'danger', title: 'The move was not saved', body: error.message });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const { mutate } = mutation;
  const drop = useCallback(
    (ids: readonly string[], target: DropTarget, visibleIds: readonly string[]): boolean => {
      const data = queryClient.getQueryData<Backlog>(backlogKeys.backlog(projectKey));
      const plan = data ? planMove(data, ids, target, visibleIds) : null;
      if (plan) mutate(plan);
      return plan !== null;
    },
    [queryClient, mutate, projectKey],
  );

  return { drop, isMoving: mutation.isPending };
}
