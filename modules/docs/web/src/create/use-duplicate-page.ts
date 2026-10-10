import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

/** The copy's title: "Runbook (copy)", or "Untitled (copy)". */
export const copyTitle = (title: string) => `${title.trim() || 'Untitled'} (copy)`.slice(0, 500);

/**
 * Duplicate: a copy of the page right after it, with its icon and its words as last saved,
 * and none of the pages under it. The toast's Undo moves the copy to the trash again. Made
 * from the page's stored body through the ordinary create, so no copy endpoint is needed.
 */
export function useDuplicatePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const refresh = () => queryClient.invalidateQueries({ queryKey: docsKeys.all() });

  const mutation = useMutation({
    mutationFn: async (pageId: string) => {
      const page = await api.docs.pages.get(pageId);
      return api.docs.pages.create({
        spaceId: page.spaceId,
        parentId: page.parentId,
        title: copyTitle(page.title),
        afterId: page.id,
        ...(page.icon ? { icon: page.icon } : {}),
        ...(page.snapshot ? { snapshot: page.snapshot } : {}),
      });
    },
    onSuccess: (copy) => {
      void refresh();
      toast.undo({
        title: `Duplicated as “${copy.title}”`,
        onUndo: () => void api.docs.pages.remove(copy.id).then(refresh),
      });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The page was not duplicated', body: error.message }),
  });

  return {
    duplicate: (pageId: string) => {
      if (!mutation.isPending) mutation.mutate(pageId);
    },
    isPending: mutation.isPending,
  };
}
