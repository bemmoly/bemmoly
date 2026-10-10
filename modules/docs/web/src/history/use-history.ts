import type { RevisionSummary } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * A page's version history: the versions newest first, a page at a time; saving one;
 * restoring one (through the live document, so open editors see it, and recorded as a new
 * version); and the structural compare of two versions or of one and the page now.
 */

/** "current" names the page as it is now on either side of a compare. */
export const CURRENT = 'current';

const PAGE_SIZE = 30;

export function useRevisions(pageId: string) {
  const query = useInfiniteQuery({
    queryKey: docsKeys.revisions(pageId),
    queryFn: ({ pageParam }) =>
      api.docs.revisions.list(pageId, {
        limit: PAGE_SIZE,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 30_000,
  });
  const revisions: RevisionSummary[] = query.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...query, revisions };
}

export function useCompare(pageId: string, from: string | null, to: string = CURRENT) {
  return useQuery({
    queryKey: docsKeys.compare(pageId, from ?? '', to),
    queryFn: () => api.docs.revisions.compare(pageId, { from: from!, to }),
    enabled: Boolean(from) && from !== to,
    staleTime: to === CURRENT ? 0 : Infinity,
  });
}

export function useSaveVersion(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (label: string | undefined) =>
      api.docs.revisions.create(pageId, label ? { label } : {}),
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.revisions(pageId) }),
  });
}

export function useRestoreVersion(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (revisionId: string) => api.docs.revisions.restore(pageId, revisionId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: docsKeys.revisions(pageId) });
      void queryClient.invalidateQueries({ queryKey: docsKeys.page(pageId) });
      void queryClient.invalidateQueries({ queryKey: [...docsKeys.all(), 'comments', pageId] });
    },
  });
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Try again in a moment.';

/**
 * Restore at once, with Undo. The page as it reads now is saved as a version first, so Undo
 * restores exactly that, and the history keeps both. Fails say what did not happen and
 * offer Retry.
 */
export function useRestoreWithUndo(pageId: string) {
  const save = useSaveVersion(pageId);
  const restore = useRestoreVersion(pageId);
  const toast = useToast();
  const run = async (revision: RevisionSummary, onDone?: () => void) => {
    try {
      const before = await save.mutateAsync(`Before restoring ${revisionName(revision)}`);
      await restore.mutateAsync(revision.id);
      onDone?.();
      toast.undo({
        title: `Restored ${revisionName(revision)}`,
        body: 'Saved as a new version.',
        onUndo: () =>
          restore.mutate(before.id, {
            onError: (error) =>
              toast.show({
                tone: 'danger',
                title: 'The restore was not undone',
                body: messageOf(error),
              }),
          }),
      });
    } catch (error) {
      toast.show({
        tone: 'danger',
        title: 'The version was not restored',
        body: messageOf(error),
        action: { label: 'Retry', onClick: () => void run(revision, onDone) },
      });
    }
  };
  return { restore: run, pending: save.isPending || restore.isPending };
}

/** A version's name as the list shows it: its label, or what made it. */
export function revisionName(revision: RevisionSummary): string {
  if (revision.label) return revision.label;
  switch (revision.kind) {
    case 'named':
      return `Version ${revision.number}`;
    case 'publish':
      return 'Published';
    case 'restore':
      return 'Restored an earlier version';
    case 'periodic':
      return 'Autosaved';
  }
}

export const KIND_LABELS: Record<RevisionSummary['kind'], string> = {
  named: 'Saved',
  periodic: 'Autosave',
  publish: 'Published',
  restore: 'Restore',
};
