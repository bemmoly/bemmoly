import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RichText } from '../../../../shared/common.ts';
import { useFreshPages } from '../../create/fresh-pages.ts';
import { replacePageFile } from '../../create/use-upload-page.ts';
import { docsKeys } from '../../shared/keys.ts';
import { useUpdatePage } from '../use-page-actions.ts';

/** What a page becomes, said in the toast. */
const BECOMES = { page: 'a page', file: 'a file page', folder: 'a folder' } as const;

/**
 * Turn into: sets the page's kind (ADR 0049), with the live body when the editor has one so
 * the server judges what is on screen. The cache takes the new kind at once, so the screen
 * switches to the page, the file or the folder it now is; a refusal puts it back. A page
 * just made is no longer fresh, so leaving its editor does not drop it as abandoned.
 */
export function useTurnInto(page: Pick<PageDetail, 'id' | 'kind'>) {
  const update = useUpdatePage(page.id);
  const { show } = useToast();
  return {
    turnInto: (kind: PageDetail['kind'], body?: RichText) => {
      useFreshPages.getState().remove(page.id);
      update.mutate(
        { kind, ...(body ? { snapshot: body } : {}) },
        {
          onSuccess: () =>
            show({
              tone: 'ok',
              title: `Turned into ${BECOMES[kind]}`,
              action: { label: 'Undo', onClick: () => update.mutate({ kind: page.kind }) },
            }),
        },
      );
    },
    isPending: update.isPending,
  };
}

/** Replace file: uploads a PDF or HTML file to show in place of the file page's own. */
export function useReplaceFile(pageId: string) {
  const queryClient = useQueryClient();
  const { show } = useToast();
  return useMutation({
    mutationFn: (file: File) => replacePageFile(pageId, file),
    onSuccess: (page) => {
      queryClient.setQueryData(docsKeys.page(pageId), page);
      show({ tone: 'ok', title: 'File replaced' });
    },
    onError: (error) =>
      show({ tone: 'danger', title: 'The file was not replaced', body: error.message }),
  });
}
