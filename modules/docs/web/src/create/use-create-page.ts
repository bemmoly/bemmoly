import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { useTreeOpen } from '../space/tree-store.ts';
import { useFreshPages } from './fresh-pages.ts';

export interface PagePlace {
  spaceId: string;
  /** The page it goes under; the top of the space when null. */
  parentId: string | null;
  /** Named in the toast: "Page created in Platform". */
  placeName: string;
}

/**
 * Create in place: N, a row's + or New page makes "Untitled" where the person is and opens
 * it with the caret in the title, no dialog in between. The toast's Undo takes the page back
 * out and returns to where they were.
 */
export function useCreatePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reveal = useTreeOpen((state) => state.reveal);
  const markFresh = useFreshPages((state) => state.add);

  const refresh = () => queryClient.invalidateQueries({ queryKey: docsKeys.all() });

  const undo = async (page: PageDetail, from: string) => {
    useFreshPages.getState().remove(page.id);
    navigateTo(from);
    await api.docs.pages.remove(page.id);
    await refresh();
  };

  const mutation = useMutation({
    mutationFn: (place: PagePlace) =>
      api.docs.pages.create({ spaceId: place.spaceId, parentId: place.parentId, title: '' }),
    onSuccess: (page, place) => {
      const from = window.location.pathname + window.location.search;
      queryClient.setQueryData(docsKeys.page(page.id), page);
      if (page.parentId) reveal(page.spaceKey, [page.parentId]);
      markFresh(page.id);
      void refresh();
      navigateTo(docsPaths.page(page.id));
      toast.undo({
        title: `Page created in ${place.placeName}`,
        onUndo: () => void undo(page, from),
      });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The page was not created', body: error.message }),
  });

  return {
    /** Ignored while a create is on its way, so a held N makes one page. */
    create: (place: PagePlace) => {
      if (!mutation.isPending) mutation.mutate(place);
    },
    isPending: mutation.isPending,
  };
}
