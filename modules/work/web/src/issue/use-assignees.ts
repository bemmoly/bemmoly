import type { IssueDetail } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { issueKeys } from '../hooks/issue-keys.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

type Assignee = IssueDetail['assignees'][number];

/**
 * Everyone on the issue, replaced as one list: the page shows the new set at once, with the first
 * person as the primary assignee, and a refusal puts the old set back with Retry.
 */
export function useAssignees(key: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = issueKeys.detail(key);
  const mutation = useMutation({
    mutationFn: (people: Assignee[]) =>
      api.work.issues.setAssignees(
        key,
        people.map((person) => person.id),
      ),
    onMutate: async (people) => {
      await queryClient.cancelQueries({ queryKey: detail, exact: true });
      const before = queryClient.getQueryData<IssueDetail>(detail);
      const primary = people[0] ?? null;
      if (before) {
        queryClient.setQueryData<IssueDetail>(detail, {
          ...before,
          assignees: people,
          assigneeIds: people.map((person) => person.id),
          assigneeId: primary?.id ?? null,
          assignee: primary,
        });
      }
      return { before };
    },
    onError: (_error, _people, context) => {
      if (context?.before) queryClient.setQueryData(detail, context.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detail });
      void queryClient.invalidateQueries({ queryKey: workKeys.all() });
    },
  });

  const set = useCallback(
    function set(people: Assignee[]): void {
      mutation.mutate(people, {
        onError: (error) =>
          toast.show({
            tone: 'danger',
            title: 'The assignees were not saved',
            body: error.message,
            action: { label: 'Retry', onClick: () => set(people) },
          }),
      });
    },
    [mutation, toast],
  );

  return { set, pending: mutation.isPending };
}
