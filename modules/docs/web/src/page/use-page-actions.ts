import type { PageStatus } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PageDetail, UpdatePageBody } from '../../../shared/pages.ts';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { trashedPageKey } from './use-page-load.ts';

/*
 * The writes the page screen makes. Each puts the server's answer in the page cache, so the
 * header, the panel and the tree agree at once; the realtime event that follows refreshes
 * every other open tab. Failures say what did not happen and leave the cache as it was.
 */

function usePageCache(pageId: string) {
  const queryClient = useQueryClient();
  return {
    queryClient,
    read: () => queryClient.getQueryData<PageDetail>(docsKeys.page(pageId)),
    write: (page: PageDetail) => queryClient.setQueryData(docsKeys.page(pageId), page),
    /** The sidebar's rows carry titles and statuses; the home lists too. */
    refreshLists: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [...docsKeys.all(), 'tree'] }),
        queryClient.invalidateQueries({ queryKey: docsKeys.recent() }),
      ]),
  };
}

/** Title, icon and owner: optimistic, since the person is looking at the field they changed. */
export function useUpdatePage(pageId: string) {
  const cache = usePageCache(pageId);
  const { show } = useToast();
  return useMutation({
    mutationFn: (body: UpdatePageBody) => api.docs.pages.update(pageId, body),
    onMutate: async (body) => {
      await cache.queryClient.cancelQueries({ queryKey: docsKeys.page(pageId) });
      const before = cache.read();
      if (before) cache.write({ ...before, ...body, owner: before.owner } as PageDetail);
      return { before };
    },
    onSuccess: (page) => {
      cache.write(page);
      void cache.refreshLists();
    },
    onError: (error, body, context) => {
      if (context?.before) cache.write(context.before);
      const what =
        body.title !== undefined ? 'title' : body.ownerId !== undefined ? 'owner' : 'change';
      show({ tone: 'danger', title: `The ${what} was not saved`, body: error.message });
    },
  });
}

/** Moves the page through draft, in review, published and archived; reviewers go first. */
export function useChangeStatus(pageId: string) {
  const cache = usePageCache(pageId);
  const { show } = useToast();
  return useMutation({
    mutationFn: async ({ status, reviewers }: { status: PageStatus; reviewers?: string[] }) => {
      if (reviewers) await api.docs.pages.setReviewers(pageId, { reviewers });
      return api.docs.pages.setStatus(pageId, { status });
    },
    onSuccess: (page) => {
      cache.write(page);
      void cache.refreshLists();
      void cache.queryClient.invalidateQueries({ queryKey: docsKeys.attention() });
    },
    onError: (error) =>
      show({ tone: 'danger', title: 'The status did not change', body: error.message }),
  });
}

export function useSetReviewers(pageId: string) {
  const cache = usePageCache(pageId);
  const { show } = useToast();
  return useMutation({
    mutationFn: (reviewers: string[]) => api.docs.pages.setReviewers(pageId, { reviewers }),
    onSuccess: (page) => cache.write(page),
    onError: (error) =>
      show({ tone: 'danger', title: 'Reviewers were not saved', body: error.message }),
  });
}

/** Labels replace the set; the page shows the new set before the server answers. */
export function useSetLabels(pageId: string) {
  const cache = usePageCache(pageId);
  const { show } = useToast();
  return useMutation({
    mutationFn: (labels: string[]) => api.docs.labels.set(pageId, labels),
    onMutate: (labels) => {
      const before = cache.read();
      if (before) cache.write({ ...before, labels });
      return { before };
    },
    onError: (error, _labels, context) => {
      if (context?.before) cache.write(context.before);
      show({ tone: 'danger', title: 'Labels were not saved', body: error.message });
    },
  });
}

/**
 * Move to trash with an Undo on the toast, and Restore for the banner a trashed page shows.
 * The screen stays where it is: the page reads as trashed until it is restored.
 */
export function useTrashPage(page: Pick<PageDetail, 'id' | 'title' | 'spaceKey'>) {
  const cache = usePageCache(page.id);
  const { show } = useToast();
  const settle = async () => {
    await cache.queryClient.invalidateQueries({ queryKey: docsKeys.page(page.id) });
    await cache.queryClient.invalidateQueries({ queryKey: docsKeys.trash(page.spaceKey) });
    await cache.refreshLists();
  };
  const restore = useMutation({
    mutationFn: () => api.docs.pages.restore(page.id),
    onSuccess: (restored) => {
      cache.write(restored);
      cache.queryClient.removeQueries({ queryKey: trashedPageKey(page.id) });
      show({ tone: 'ok', title: `“${restored.title || 'Untitled'}” restored` });
    },
    onError: (error) =>
      show({ tone: 'danger', title: 'The page was not restored', body: error.message }),
    onSettled: settle,
  });
  const trash = useMutation({
    mutationFn: () => api.docs.pages.remove(page.id),
    onSuccess: () =>
      show({
        title: `“${page.title || 'Untitled'}” moved to trash`,
        body: 'Pages under it went too.',
        action: { label: 'Undo', onClick: () => restore.mutate() },
        duration: 8000,
      }),
    onError: (error) =>
      show({ tone: 'danger', title: 'The page was not moved to the trash', body: error.message }),
    onSettled: settle,
  });
  return { trash, restore };
}
