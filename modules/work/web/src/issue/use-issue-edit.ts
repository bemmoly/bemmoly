import type { IssueDetail, UpdateIssueBody } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { issueKeys } from '../hooks/issue-keys.ts';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

export interface IssueEdit {
  body: UpdateIssueBody;
  /**
   * What the page shows once the edit lands, beyond the raw ids: the assignee's name, the
   * status's name and category, the labels. Applied with the body before the server answers.
   */
  shown?: Partial<IssueDetail>;
  /** "The assignee", "The labels": names the field in the error. */
  what: string;
  /**
   * For a change worth taking back (status, a removed label): the toast that confirms it and
   * the edit that restores the old value, offered as Undo for the toast's few seconds.
   */
  undo?: { title: string; edit: IssueEdit };
}

export interface EditOptions {
  onSuccess?: () => void;
}

/**
 * Every field edit on the issue: the page shows the new value at once, the server is asked,
 * and a refusal puts the old value back with a toast that offers Retry. The detail, history
 * and transitions are read again once it settles, so derived values come from the server.
 */
export function useIssueEdit(key: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const detail = issueKeys.detail(key);
  const mutation = useMutation({
    mutationFn: ({ body }: IssueEdit) => api.work.issues.update(key, body),
    onMutate: async ({ body, shown }) => {
      await queryClient.cancelQueries({ queryKey: detail, exact: true });
      const before = queryClient.getQueryData<IssueDetail>(detail);
      if (before) queryClient.setQueryData<IssueDetail>(detail, { ...before, ...body, ...shown });
      return { before };
    },
    onError: (_error, _edit, context) => {
      if (context?.before) queryClient.setQueryData(detail, context.before);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: detail });
      void queryClient.invalidateQueries({ queryKey: [...workKeys.all(), 'subtasks'] });
    },
  });

  const edit = useCallback(
    function edit(change: IssueEdit, options: EditOptions = {}): void {
      const run = () =>
        mutation.mutate(change, {
          onSuccess: () => {
            options.onSuccess?.();
            const undo = change.undo;
            if (undo) toast.undo({ title: undo.title, onUndo: () => edit(undo.edit) });
          },
          onError: (error) =>
            toast.show({
              tone: 'danger',
              title: `${change.what} was not saved`,
              body: error.message,
              action: { label: 'Retry', onClick: run },
            }),
        });
      run();
    },
    [mutation, toast],
  );

  /**
   * The same edit for a caller that reports the outcome itself, such as an autosaving editor
   * with its saved state: no toast, and the promise rejects when the server refuses.
   */
  const save = useCallback((change: IssueEdit) => mutation.mutateAsync(change), [mutation]);

  return { edit, save, pending: mutation.isPending };
}
