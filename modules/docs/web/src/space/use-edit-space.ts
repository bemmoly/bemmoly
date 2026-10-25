import type { Space } from '@bemmoly/module-docs/shared';
import { spaceTone, useToast, type SpaceTone } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

export interface SpaceEdit {
  name: string;
  description: string;
  tone: SpaceTone;
}

type Errors = Partial<Record<'name' | 'form', string>>;

/**
 * The edit-space form: name, description and colour, starting from what the space has now.
 * The key stays as it is, since every link into the space carries it.
 */
export function useEditSpace(space: Space, onSaved: () => void) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<SpaceEdit>({
    name: space.name,
    description: space.description ?? '',
    tone: spaceTone(space.key, space.color),
  });
  const [errors, setErrors] = useState<Errors>({});
  const save = useMutation({
    mutationFn: () =>
      api.docs.spaces.update(space.key, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        color: draft.tone,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(docsKeys.space(space.key), next);
      void queryClient.invalidateQueries({ queryKey: docsKeys.spaces() });
      toast.show({ tone: 'ok', title: 'Space saved' });
      onSaved();
    },
    onError: (error) => setErrors({ form: error.message }),
  });

  return {
    draft,
    errors,
    isSubmitting: save.isPending,
    setName: (name: string) => {
      setDraft((current) => ({ ...current, name }));
      setErrors(({ name: _name, ...rest }) => rest);
    },
    setDescription: (description: string) => setDraft((current) => ({ ...current, description })),
    setTone: (tone: SpaceTone) => setDraft((current) => ({ ...current, tone })),
    submit: () => {
      const found: Errors = draft.name.trim() ? {} : { name: 'Give the space a name' };
      setErrors(found);
      if (!found.name && !save.isPending) save.mutate();
    },
  };
}
