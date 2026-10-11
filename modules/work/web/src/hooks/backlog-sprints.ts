import { queryKeys } from '@bemmoly/api-client';
import type {
  CompleteSprintBody,
  CreateIssueBody,
  Sprint,
  UpdateSprintBody,
} from '@bemmoly/module-work/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { planning } from './backlog-client.ts';

export interface StartSprintInput {
  sprint: Sprint;
  name: string;
  goal: string;
  startsAt: string;
  endsAt: string;
}

/**
 * The Backlog's sprint and create actions. Each refreshes every Work query
 * when it settles, since a sprint change moves the Board as well; the live
 * event that follows asks for the same refresh and costs nothing extra.
 */
export function useSprintActions(projectKey: string) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.work() });

  const create = useMutation({
    mutationFn: (name: string) => planning.create(projectKey, { name }),
    onSettled: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSprintBody }) => planning.update(id, body),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => planning.remove(id),
    onSettled: refresh,
  });

  /** The dialog edits name and goal as well as dates; the start call takes only dates. */
  const start = useMutation({
    mutationFn: async ({ sprint, name, goal, startsAt, endsAt }: StartSprintInput) => {
      const nextGoal = goal.trim() || null;
      if (name.trim() !== sprint.name || nextGoal !== sprint.goal) {
        await planning.update(sprint.id, { name: name.trim(), goal: nextGoal });
      }
      return planning.start(sprint.id, { startsAt, endsAt });
    },
    onSettled: refresh,
  });

  const complete = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CompleteSprintBody }) =>
      planning.complete(id, body),
    onSettled: refresh,
  });

  const createIssue = useMutation({
    mutationFn: (body: CreateIssueBody) => planning.createIssue(body),
    onSettled: refresh,
  });

  return { create, update, remove, start, complete, createIssue };
}
