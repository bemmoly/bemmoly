import type { TrashItem } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../shared/api.ts';
import { docsKeys } from '../../shared/keys.ts';
import { docsPaths, navigateTo } from '../../shared/navigation.ts';

export const pageTitle = (page: { title: string }) => page.title || 'Untitled';

export function useTrash(spaceKey: string) {
  return useInfiniteQuery({
    queryKey: docsKeys.trash(spaceKey),
    queryFn: ({ pageParam }) =>
      api.docs.spaces.trash(spaceKey, { limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Space and workspace admins may delete forever; the members list says which you are. */
export function useCanPurge(spaceKey: string): boolean {
  const members = useQuery({
    queryKey: docsKeys.members(spaceKey),
    queryFn: () => api.docs.members.list(spaceKey),
    staleTime: 60_000,
  });
  return members.data?.canManage ?? false;
}

/** The trashed page itself, read-only, for the peek. */
export function useTrashedPage(pageId: string | null) {
  return useQuery({
    queryKey: [...docsKeys.page(pageId ?? ''), 'trashed'],
    queryFn: () => api.docs.pages.get(pageId ?? '', { deleted: true }),
    enabled: Boolean(pageId),
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: docsKeys.all() });
}

/** Restore at once; the toast opens the page where it came back. */
export function useRestore(onDone?: (page: TrashItem) => void) {
  const refresh = useRefresh();
  const { show } = useToast();
  return useMutation({
    mutationFn: async (page: TrashItem) => {
      await api.docs.pages.restore(page.id);
      return page;
    },
    onSuccess: (page) => {
      onDone?.(page);
      show({
        tone: 'ok',
        title: `“${pageTitle(page)}” restored to ${page.wasIn ? pageTitle(page.wasIn) : 'the top of the space'}`,
        action: { label: 'Open', onClick: () => navigateTo(docsPaths.page(page.id)) },
      });
    },
    onError: (error) => show({ tone: 'danger', title: 'Not restored', body: error.message }),
    onSettled: refresh,
  });
}

export function useDeleteForever(spaceKey: string, onDone?: (page: TrashItem) => void) {
  const refresh = useRefresh();
  const { show } = useToast();
  return useMutation({
    mutationFn: async (page: TrashItem) => {
      await api.docs.spaces.deleteForever(spaceKey, page.id);
      return page;
    },
    onSuccess: (page) => {
      onDone?.(page);
      show({ tone: 'ok', title: `“${pageTitle(page)}” deleted forever` });
    },
    onSettled: refresh,
  });
}

export function useEmptyTrash(spaceKey: string, onDone?: () => void) {
  const refresh = useRefresh();
  const { show } = useToast();
  return useMutation({
    mutationFn: () => api.docs.spaces.emptyTrash(spaceKey),
    onSuccess: ({ deleted }) => {
      onDone?.();
      show({
        tone: 'ok',
        title: `Trash emptied`,
        body: `${deleted} ${deleted === 1 ? 'page was' : 'pages were'} deleted forever.`,
      });
    },
    onSettled: refresh,
  });
}
