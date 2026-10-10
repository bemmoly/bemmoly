import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { PageEditor } from '../page/screen-context.ts';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { docsPaths, replaceWith } from '../shared/navigation.ts';
import { useFreshPages } from './fresh-pages.ts';

/** True while the live body has no text, following every edit. */
export function useBodyEmpty(editor: PageEditor | null): boolean {
  const [empty, setEmpty] = useState(() => editor?.isEmpty ?? false);
  useEffect(() => {
    if (!editor) return undefined;
    const update = () => setEmpty(editor.isEmpty);
    update();
    editor.on('update', update);
    return () => {
      editor.off('update', update);
    };
  }, [editor]);
  return empty;
}

/** Puts the caret in the title once it is on screen; the page renders a frame or two later. */
export function useFocusTitle(pageId: string, fresh: boolean, fieldId: string) {
  useEffect(() => {
    if (!fresh) return undefined;
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      const field = document.getElementById(fieldId);
      if (field instanceof HTMLTextAreaElement) {
        field.focus();
        return;
      }
      if ((tries += 1) < 120) frame = requestAnimationFrame(attempt);
    };
    attempt();
    return () => cancelAnimationFrame(frame);
  }, [pageId, fresh, fieldId]);
}

/**
 * A fresh page left with no title and no words is taken back out when the person moves on,
 * so a stray N leaves nothing behind. Reads the latest state at unmount through refs.
 */
export function useDropAbandoned(page: PageDetail, fresh: boolean, empty: boolean) {
  const latest = useRef({ title: page.title, fresh, empty });
  latest.current = { title: page.title, fresh, empty };
  const queryClient = useQueryClient();
  useEffect(
    () => () => {
      const { title, fresh: wasFresh, empty: wasEmpty } = latest.current;
      if (!wasFresh || title.trim() || !wasEmpty) return;
      useFreshPages.getState().remove(page.id);
      void api.docs.pages
        .remove(page.id)
        .then(() => queryClient.invalidateQueries({ queryKey: docsKeys.all() }))
        .catch(() => undefined);
    },
    [page.id, queryClient],
  );
}

/** Swaps the blank page for one made from the template, in the same place and title. */
export function useApplyTemplate(page: PageDetail) {
  const queryClient = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const title = page.title.trim();
      return api.docs.templates.createPage(templateId, {
        spaceId: page.spaceId,
        parentId: page.parentId,
        ...(title ? { title } : {}),
      });
    },
    // The blank page goes once the new one is on screen; removing it first would pull the
    // open editor out from under the person.
    onSuccess: async (made) => {
      useFreshPages.getState().remove(page.id);
      queryClient.setQueryData(docsKeys.page(made.id), made);
      replaceWith(docsPaths.page(made.id));
      await api.docs.pages.remove(page.id).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: docsKeys.all() });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The template was not applied', body: error.message }),
  });
}
