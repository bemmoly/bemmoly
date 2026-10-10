import type {
  CreatePageBody,
  MovePageBody,
  PageDetail,
  SetStatusBody,
} from '@bemmoly/module-docs/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/*
 * The writes the Docs screens make. Each settles by invalidating what it can
 * have changed; the realtime event that follows does the same for every
 * other open tab. Star flips the cached page at once, as a toggle should.
 */

export function useCreatePage(onCreated?: (page: PageDetail) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePageBody) => api.docs.pages.create(body),
    onSuccess: (page) => {
      queryClient.setQueryData(docsKeys.page(page.id), page);
      void queryClient.invalidateQueries({ queryKey: [...docsKeys.all(), 'tree'] });
      void queryClient.invalidateQueries({ queryKey: docsKeys.recent() });
      onCreated?.(page);
    },
  });
}

export function useMovePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pageId, body }: { pageId: string; body: MovePageBody }) =>
      api.docs.pages.move(pageId, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...docsKeys.all(), 'tree'] }),
  });
}

export function useSetPageStatus(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetStatusBody) => api.docs.pages.setStatus(pageId, body),
    onSuccess: (page) => queryClient.setQueryData(docsKeys.page(pageId), page),
  });
}

export function useStarPage(pageId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (starred: boolean) => api.docs.stars.set(pageId, starred),
    onMutate: async (starred) => {
      await queryClient.cancelQueries({ queryKey: docsKeys.page(pageId) });
      const before = queryClient.getQueryData<PageDetail>(docsKeys.page(pageId));
      if (before) queryClient.setQueryData(docsKeys.page(pageId), { ...before, starred });
      return { before };
    },
    onError: (_error, _starred, context) => {
      if (context?.before) queryClient.setQueryData(docsKeys.page(pageId), context.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.starred() }),
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pageId: string) => api.docs.pages.remove(pageId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: docsKeys.all() }),
  });
}
