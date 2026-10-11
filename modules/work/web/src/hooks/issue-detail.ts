import type { IssueDetail, UpdateIssueBody } from '@bemmoly/module-work/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { issueKeys } from './issue-keys.ts';

const issues = api.work.issues;

/** The issue with the names printed beside each field, in one request. */
export function useIssue(key: string | undefined) {
  return useQuery({
    queryKey: issueKeys.detail(key ?? ''),
    queryFn: () => issues.get(key ?? ''),
    enabled: Boolean(key),
  });
}

/** Where the issue can go from its status; blocked transitions say why. */
export function useTransitions(key: string, enabled = true) {
  return useQuery({
    queryKey: issueKeys.transitions(key),
    queryFn: () => issues.transitions(key),
    enabled,
  });
}

/** The issue's subtasks as full rows, so each can show its assignee. */
export function useSubtasks(issueId: string | undefined) {
  return useQuery({
    queryKey: issueKeys.subtasks(issueId ?? ''),
    queryFn: async () => (await issues.list({ parentId: issueId, limit: 100 })).items,
    enabled: Boolean(issueId),
  });
}

/**
 * One field edit. The detail cache takes the new values at once so the sidebar does not
 * flicker; the server's answer, history and transitions are read again after it settles.
 */
export function useUpdateIssue(key: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateIssueBody) => issues.update(key, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: issueKeys.detail(key), exact: true });
      const before = queryClient.getQueryData<IssueDetail>(issueKeys.detail(key));
      if (before) {
        queryClient.setQueryData<IssueDetail>(issueKeys.detail(key), { ...before, ...body });
      }
      return { before };
    },
    onError: (_error, _body, context) => {
      if (context?.before) queryClient.setQueryData(issueKeys.detail(key), context.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: issueKeys.detail(key) });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all(), 'subtasks'] });
    },
  });
}
