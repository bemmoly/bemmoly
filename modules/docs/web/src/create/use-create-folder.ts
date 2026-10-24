import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { useTreeOpen } from '../space/tree-store.ts';
import { useTreeRename } from '../space/tree-rename.ts';
import type { PagePlace } from './use-create-page.ts';

/** What a new folder is called until it is renamed. */
export const NEW_FOLDER_TITLE = 'New folder';

/**
 * New folder (ADR 0049): made where the person is and opened, with its row in the tree ready
 * to rename. The toast's Undo takes it back out and returns to where they were.
 */
export function useCreateFolder() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reveal = useTreeOpen((state) => state.reveal);
  const rename = useTreeRename((state) => state.start);
  const refresh = () => queryClient.invalidateQueries({ queryKey: docsKeys.all() });

  const undo = async (folder: PageDetail, from: string) => {
    navigateTo(from);
    await api.docs.pages.remove(folder.id);
    await refresh();
  };

  const mutation = useMutation({
    mutationFn: (place: PagePlace) =>
      api.docs.pages.create({
        spaceId: place.spaceId,
        parentId: place.parentId,
        kind: 'folder',
        title: NEW_FOLDER_TITLE,
      }),
    onSuccess: (folder, place) => {
      const from = window.location.pathname + window.location.search;
      queryClient.setQueryData(docsKeys.page(folder.id), folder);
      if (folder.parentId) reveal(folder.spaceKey, [folder.parentId]);
      void refresh();
      navigateTo(docsPaths.page(folder.id));
      rename(folder.id);
      toast.undo({
        title: `Folder created in ${place.placeName}`,
        onUndo: () => void undo(folder, from),
      });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The folder was not created', body: error.message }),
  });

  return {
    create: (place: PagePlace) => {
      if (!mutation.isPending) mutation.mutate(place);
    },
    isPending: mutation.isPending,
  };
}
