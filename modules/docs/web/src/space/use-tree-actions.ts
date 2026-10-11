import type { PageDetail, PageSummary } from '@bemmoly/module-docs/shared';
import { useToast, type PageTreeMove } from '@bemmoly/ui';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { moveInLevels, removeFromLevels, renameInLevels, type TreeLevels } from './tree-cache.ts';
import { useTreeOpen } from './tree-store.ts';

/** Every loaded sidebar level of a space, keyed by parent. */
export function readLevels(queryClient: QueryClient, spaceKey: string): TreeLevels {
  const levels: TreeLevels = new Map();
  for (const [key, rows] of queryClient.getQueriesData<PageSummary[]>({
    queryKey: docsKeys.spaceTree(spaceKey),
  })) {
    if (key[4] === 'level' && rows) levels.set(key[3] as string | null, rows);
  }
  return levels;
}

function writeLevels(queryClient: QueryClient, spaceKey: string, levels: TreeLevels) {
  for (const [parentId, rows] of levels) {
    queryClient.setQueryData(docsKeys.treeLevel(spaceKey, parentId), rows);
  }
}

/**
 * The shape every tree write takes: stop in-flight reads of the tree, paint the change at
 * once, put the old tree back if the server says no, and refetch either way so every
 * level ends up as the server has it. Other tabs follow through the realtime event.
 */
function useTreeWrite<Vars>(
  spaceKey: string,
  write: (vars: Vars) => Promise<unknown>,
  paint: (levels: TreeLevels, vars: Vars) => TreeLevels,
  failure: string,
) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: write,
    onMutate: async (vars: Vars) => {
      await queryClient.cancelQueries({ queryKey: docsKeys.spaceTree(spaceKey) });
      const before = readLevels(queryClient, spaceKey);
      writeLevels(queryClient, spaceKey, paint(before, vars));
      return { before };
    },
    onError: (error, _vars, context) => {
      if (context) writeLevels(queryClient, spaceKey, context.before);
      show({ tone: 'danger', title: failure, body: error.message });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.all() }),
  });
}

/** A drag or Alt+arrow move, optimistic, rolled back with a toast when refused. */
export function useMoveInTree(spaceKey: string) {
  const reveal = useTreeOpen((state) => state.reveal);
  return useTreeWrite(
    spaceKey,
    ({ id, parentId, afterId, beforeId }: PageTreeMove) =>
      api.docs.pages.move(id, {
        parentId,
        ...(afterId ? { afterId } : {}),
        ...(beforeId ? { beforeId } : {}),
      }),
    (levels, move) => {
      if (move.parentId) reveal(spaceKey, [move.parentId]);
      return moveInLevels(levels, move);
    },
    'The page was not moved',
  );
}

export function useRenameInTree(spaceKey: string) {
  const queryClient = useQueryClient();
  return useTreeWrite(
    spaceKey,
    async ({ id, title }: { id: string; title: string }) => {
      const page = await api.docs.pages.update(id, { title });
      queryClient.setQueryData<PageDetail>(docsKeys.page(id), page);
      return page;
    },
    (levels, { id, title }) => renameInLevels(levels, id, title),
    'The page was not renamed',
  );
}

/**
 * Moves a page and everything under it to the trash, with an Undo on the toast that
 * restores it where it was. `onTrashed` lets the screen leave a page that is now gone.
 */
export function useTrashFromTree(spaceKey: string, onTrashed?: (pageId: string) => void) {
  const { show } = useToast();
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: (id: string) => api.docs.pages.restore(id),
    onSuccess: () => show({ tone: 'ok', title: 'Page restored' }),
    onError: (error) => show({ tone: 'danger', title: 'Not restored', body: error.message }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.all() }),
  });
  const trash = useTreeWrite(
    spaceKey,
    async ({ id }: { id: string; title: string }) => api.docs.pages.remove(id),
    (levels, { id }) => removeFromLevels(levels, id),
    'The page was not moved to the trash',
  );
  return {
    isPending: trash.isPending,
    trash: (page: { id: string; title: string }) =>
      trash.mutate(page, {
        onSuccess: () => {
          onTrashed?.(page.id);
          show({
            title: `“${page.title || 'Untitled'}” moved to trash`,
            body: 'Pages under it went too.',
            action: { label: 'Undo', onClick: () => restore.mutate(page.id) },
            duration: 8000,
          });
        },
      }),
  };
}

export function useStarFromTree() {
  const queryClient = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: ({ id, starred }: { id: string; starred: boolean }) =>
      api.docs.stars.set(id, starred),
    onSuccess: (_result, { starred }) =>
      show({ tone: 'ok', title: starred ? 'Starred' : 'Removed from starred' }),
    onError: (error) => show({ tone: 'danger', title: 'Not starred', body: error.message }),
    onSettled: (_result, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: docsKeys.starred() });
      void queryClient.invalidateQueries({ queryKey: docsKeys.page(id) });
    },
  });
}
