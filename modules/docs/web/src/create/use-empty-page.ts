import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useToast } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { PageEditor } from '../page/screen-context.ts';
import { useUpdatePage } from '../page/use-page-actions.ts';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
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

/**
 * Fills the blank page with the template's document, in place: the same page, the same
 * place and any title already typed (the template's name otherwise). Nothing is created or
 * thrown away, so no "Untitled" is left in the trash and Back goes where it went before.
 * The body changes through the live editor, so others see it at once and ⌘Z takes it back.
 */
export function useApplyTemplate(page: PageDetail, editor: PageEditor | null) {
  const update = useUpdatePage(page.id);
  const toast = useToast();
  return useMutation({
    mutationFn: (templateId: string) => api.docs.templates.get(templateId),
    onSuccess: (template) => {
      if (!editor || editor.isDestroyed) return;
      useFreshPages.getState().remove(page.id);
      editor.chain().setContent(template.snapshot).focus('start').run();
      if (!page.title.trim()) update.mutate({ title: template.name });
    },
    onError: (error) =>
      toast.show({ tone: 'danger', title: 'The template was not applied', body: error.message }),
  });
}
