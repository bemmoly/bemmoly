import { useToast } from '@bemmoly/ui';
import {
  useIsMutating,
  useQueryClient,
  type InvalidateQueryFilters,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '../shared/api.ts';
import { workKeys } from '../shared/keys.ts';
import { editedCaches, paintEdit } from './issue-edit-cache.ts';
import type { QuickPatch } from './issue-edit-patch.ts';

/*
 * Assign, priority and sprint from a list screen, optimistically. The edit is painted into every
 * cache that shows the issue in the same frame, then sent; an issue the server refuses goes back
 * on its own while the rest keep their edit. Edits to one issue are sent in order, one at a time,
 * and the Work reads are refreshed only once the last edit in flight settles, so a read taken
 * while others are still on their way never puts their old values back.
 */

/** "PLT-4" for one issue, "3 issues" for several. */
export const plural = (keys: readonly string[]) =>
  keys.length === 1 ? (keys[0] ?? '') : `${keys.length} issues`;

/** True while an edit to this issue is on its way; its card or row shows it quietly. */
export function useIssuePending(key: string): boolean {
  return useIsMutating({ mutationKey: workKeys.issueEdit(key) }) > 0;
}

/** One issue's edit as a mutation in the cache, queued behind any earlier edit to it. */
function send(client: QueryClient, key: string, patch: QuickPatch) {
  const mutation = client.getMutationCache().build(
    client,
    client.defaultMutationOptions({
      mutationKey: workKeys.issueEdit(key),
      scope: { id: `issue-edit:${key}` },
      mutationFn: () => api.work.issues.update(key, patch),
    }),
  );
  return mutation.execute(patch);
}

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) =>
  prefix.every((part, index) => key[index] === part);

/**
 * Refreshes the Work reads once no edit is in flight. Board views wait for a card move still on
 * its way: the move refreshes them when it lands.
 */
async function settle(client: QueryClient) {
  if (client.isMutating({ mutationKey: workKeys.issueEdits() }) > 0) return;
  const filters: InvalidateQueryFilters = { queryKey: workKeys.all() };
  if (client.isMutating({ mutationKey: workKeys.boardMoves() }) > 0)
    filters.predicate = (query) => !startsWith(query.queryKey, workKeys.boardViews());
  await client.invalidateQueries(filters);
}

export function useIssueEdits() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const update = useCallback(
    async (keys: readonly string[], patch: QuickPatch, done?: string) => {
      for (const key of keys) {
        for (const queryKey of editedCaches(key)) void queryClient.cancelQueries({ queryKey });
      }
      const painted = keys.map((key) => paintEdit(queryClient, key, patch));
      const shown = done ? toast.show({ tone: 'ok', title: done }) : undefined;
      const results = await Promise.allSettled(keys.map((key) => send(queryClient, key, patch)));
      const failed: unknown[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') return;
        painted[index]?.restore();
        failed.push(result.reason);
      });
      if (failed.length > 0) {
        if (shown) toast.dismiss(shown);
        const reason = failed[0];
        toast.show({
          tone: 'danger',
          title:
            failed.length === keys.length
              ? `${plural(keys)} could not be changed`
              : `${failed.length} of ${keys.length} issues could not be changed`,
          body: reason instanceof Error ? reason.message : 'Try again in a moment.',
        });
      }
      await settle(queryClient);
    },
    [queryClient, toast],
  );

  return update;
}
