import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths, navigateTo } from '../shared/navigation.ts';
import { useTreeOpen } from '../space/tree-store.ts';
import type { PagePlace } from './use-create-page.ts';
import { createFilePage, PAGE_FILE_ACCEPT } from './use-upload-page.ts';

/** Opens the system file picker; a detached input needs no place in the page. */
function pickFile(onPick: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = PAGE_FILE_ACCEPT;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  });
  input.click();
}

/**
 * Upload file from a +: the picked file becomes a file page right where the + was (ADR
 * 0049), named after the file, and opens. The toast's Undo takes it back out.
 */
export function useUploadFilePage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const reveal = useTreeOpen((state) => state.reveal);

  const undo = async (page: PageDetail, from: string) => {
    navigateTo(from);
    await api.docs.pages.remove(page.id);
    await queryClient.invalidateQueries({ queryKey: docsKeys.all() });
  };

  const mutation = useMutation({
    mutationFn: ({ place, file }: { place: PagePlace; file: File }) =>
      createFilePage({ spaceId: place.spaceId, parentId: place.parentId, title: '' }, file),
    onSuccess: (page, { place }) => {
      const from = window.location.pathname + window.location.search;
      queryClient.setQueryData(docsKeys.page(page.id), page);
      if (page.parentId) reveal(page.spaceKey, [page.parentId]);
      void queryClient.invalidateQueries({ queryKey: docsKeys.all() });
      navigateTo(docsPaths.page(page.id));
      toast.undo({
        title: `${page.title || 'File'} added to ${place.placeName}`,
        onUndo: () => void undo(page, from),
      });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The file was not added', body: error.message }),
  });

  return {
    /** Asks for a file, then adds it at `place`. */
    upload: (place: PagePlace) => pickFile((file) => mutation.mutate({ place, file })),
    isPending: mutation.isPending,
  };
}
