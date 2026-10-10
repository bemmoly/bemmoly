import type { CreateIssueBody, Issue, UpdateIssueBody } from '@bemmoly/module-work/shared';
import { useToast } from '@bemmoly/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';

/*
 * The small edits a list screen makes without opening an issue: assign, priority, sprint, and
 * delete. They apply to one issue or to a selection. Delete waits out an Undo window before it
 * reaches the server, and the issues leave the screen at once, so undoing only puts them back.
 */

/** How long a deleted issue waits for Undo before the delete is sent. */
export const UNDO_MS = 6000;

interface Hidden {
  keys: ReadonlySet<string>;
  hide(keys: readonly string[]): void;
  show(keys: readonly string[]): void;
}

/** Issues deleted but still inside their Undo window; list screens leave them out. */
export const useHiddenIssues = create<Hidden>()((set) => ({
  keys: new Set(),
  hide: (keys) => set((state) => ({ keys: new Set([...state.keys, ...keys]) })),
  show: (keys) =>
    set((state) => ({ keys: new Set([...state.keys].filter((key) => !keys.includes(key))) })),
}));

export type QuickPatch = Pick<UpdateIssueBody, 'assigneeId' | 'priority' | 'sprintId' | 'statusId'>;

const plural = (keys: readonly string[]) =>
  keys.length === 1 ? (keys[0] ?? '') : `${keys.length} issues`;

export function useIssueQuickActions() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: workKeys.all() }),
    [queryClient],
  );

  const update = useCallback(
    async (keys: readonly string[], patch: QuickPatch, done?: string) => {
      const results = await Promise.allSettled(
        keys.map((key) => api.work.issues.update(key, patch)),
      );
      await refresh();
      const failed = results.filter((result) => result.status === 'rejected');
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason;
        toast.show({
          tone: 'danger',
          title:
            failed.length === keys.length
              ? `${plural(keys)} could not be changed`
              : `${failed.length} of ${keys.length} issues could not be changed`,
          body: reason instanceof Error ? reason.message : 'Try again in a moment.',
        });
      } else if (done) {
        toast.show({ tone: 'ok', title: done });
      }
    },
    [refresh, toast],
  );

  const remove = useCallback(
    (keys: readonly string[]) => {
      const hidden = useHiddenIssues.getState();
      hidden.hide(keys);
      let undone = false;
      const timer = window.setTimeout(() => {
        if (undone) return;
        void Promise.allSettled(keys.map((key) => api.work.issues.remove(key))).then(
          async (results) => {
            await refresh();
            useHiddenIssues.getState().show(keys);
            const failed = results.filter((result) => result.status === 'rejected').length;
            if (failed > 0)
              toast.show({
                tone: 'danger',
                title: `${failed === keys.length ? plural(keys) : `${failed} issues`} could not be deleted`,
                body: 'They are back in the list. Try again in a moment.',
              });
          },
        );
      }, UNDO_MS);
      toast.show({
        tone: 'info',
        duration: UNDO_MS,
        title: `${plural(keys)} deleted`,
        action: {
          label: 'Undo',
          onClick: () => {
            undone = true;
            window.clearTimeout(timer);
            useHiddenIssues.getState().show(keys);
          },
        },
      });
    },
    [refresh, toast],
  );

  /** Creates in place; a status other than the workflow's first is set right after. */
  const create = useCallback(
    async (body: CreateIssueBody, statusId?: string) => {
      const created = await api.work.issues.create(body);
      if (statusId && created.statusId !== statusId)
        await api.work.issues.update(created.key, { statusId });
      await refresh();
      return created;
    },
    [refresh],
  );

  return useMemo(() => ({ update, remove, create }), [update, remove, create]);
}

export type IssueQuickActions = ReturnType<typeof useIssueQuickActions>;

/** Leaves out issues waiting for their Undo window to end. */
export function withoutHidden<T extends Pick<Issue, 'key'>>(
  issues: readonly T[],
  hidden: ReadonlySet<string>,
): T[] {
  return hidden.size === 0 ? [...issues] : issues.filter((issue) => !hidden.has(issue.key));
}
