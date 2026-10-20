import { useToast } from '@bemmoly/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { plural } from './issue-edits.ts';
import { useHiddenIssues } from './hidden-issues.ts';

/*
 * Archive and unarchive for one issue or a selection. Archiving is put back by unarchiving, so
 * it is sent at once and offers Undo rather than asking first; the issues leave list screens
 * straight away and come back only if the server refuses.
 */
export function useIssueArchive() {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useCallback(
    async (keys: readonly string[], archived: boolean) => {
      const send = archived ? api.work.issues.archive : api.work.issues.unarchive;
      if (archived) useHiddenIssues.getState().hide(keys);
      const results = await Promise.allSettled(keys.map((key) => send(key)));
      await queryClient.invalidateQueries({ queryKey: workKeys.all() });
      useHiddenIssues.getState().show(keys);
      const done = keys.filter((_, index) => results[index]?.status === 'fulfilled');
      if (done.length < keys.length) {
        const failed = keys.length - done.length;
        toast.show({
          tone: 'danger',
          title: `${failed === keys.length ? plural(keys) : `${failed} issues`} could not be ${archived ? 'archived' : 'unarchived'}`,
          body: 'Nothing else changed. Try again in a moment.',
        });
      }
      if (done.length === 0) return;
      if (!archived) {
        toast.show({ tone: 'ok', title: `${plural(done)} unarchived` });
        return;
      }
      toast.undo({
        title: `${plural(done)} archived`,
        body: 'Off the board and lists. It still opens by its key.',
        onUndo: () => {
          void Promise.allSettled(done.map((key) => api.work.issues.unarchive(key))).then(
            async (undone) => {
              await queryClient.invalidateQueries({ queryKey: workKeys.all() });
              if (undone.some((result) => result.status === 'rejected'))
                toast.show({
                  tone: 'danger',
                  title: 'Some issues are still archived',
                  body: 'Open them by their key and unarchive them from the ··· menu.',
                });
            },
          );
        },
      });
    },
    [queryClient, toast],
  );
}
