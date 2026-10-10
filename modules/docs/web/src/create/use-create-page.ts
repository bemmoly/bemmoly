import type { PageDetail } from '@bemmoly/module-docs/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';
import { useTreeOpen } from '../space/tree-store.ts';

export interface CreatePagePlace {
  spaceId: string | null;
  /** The page it goes under; the space's roots when null. */
  parentId: string | null;
  /** A template already chosen, as a Templates panel chip opens the picker. */
  templateId?: string | null;
}

/**
 * The new-page form: where it goes, a template (null for a blank page) and an optional
 * title. A template page takes the template's name as its title when none is typed. On
 * success the parent opens in the sidebar so the new page shows where it was put.
 */
export function useCreatePage(place: CreatePagePlace, onCreated: (page: PageDetail) => void) {
  const queryClient = useQueryClient();
  const reveal = useTreeOpen((state) => state.reveal);
  const [chosenSpace, setSpaceId] = useState<string | null>(null);
  // The place can arrive after the first render (the spaces list loading); a choice wins.
  const spaceId = chosenSpace ?? place.spaceId;
  const [templateId, setTemplateId] = useState<string | null>(place.templateId ?? null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (chosen: string | null) => {
      if (!spaceId) throw new Error('Choose a space for the page');
      const where = { spaceId, parentId: place.parentId };
      const typed = title.trim();
      return chosen
        ? api.docs.templates.createPage(chosen, { ...where, ...(typed ? { title: typed } : {}) })
        : api.docs.pages.create({ ...where, title: typed });
    },
    onSuccess: (page) => {
      queryClient.setQueryData(docsKeys.page(page.id), page);
      if (page.parentId) reveal(page.spaceKey, [page.parentId]);
      void queryClient.invalidateQueries({ queryKey: docsKeys.all() });
      onCreated(page);
    },
    onError: (failure) => setError(failure.message),
  });

  return {
    spaceId,
    templateId,
    title,
    error,
    isSubmitting: create.isPending,
    setSpaceId: (id: string) => {
      setSpaceId(id);
      setError(null);
    },
    setTemplateId,
    setTitle,
    /** Creates with the chosen template, or with `chosen` when a card is double-clicked. */
    submit: (chosen: string | null = templateId) => {
      if (!spaceId) return setError('Choose a space for the page');
      if (!create.isPending) create.mutate(chosen);
    },
  };
}
