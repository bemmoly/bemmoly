import { ApiError } from '@bemmoly/api-client';
import { SPACE_KEY_PATTERN, type Space } from '@bemmoly/module-docs/shared';
import { SPACE_TONES, type SpaceTone } from '@bemmoly/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../shared/api.ts';
import { docsKeys } from '../shared/keys.ts';

export interface SpaceDraft {
  name: string;
  key: string;
  description: string;
  tone: SpaceTone;
}

type Errors = Partial<Record<'name' | 'key' | 'form', string>>;

/** "Platform Core" → "PC"; "Engineering" → "ENG": what a person would likely type. */
export function suggestKey(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const first = words[0] ?? '';
  const key = words.length > 1 ? words.map((word) => word[0]).join('') : first.slice(0, 3);
  return key.replace(/^[0-9]+/, '').slice(0, 10);
}

export function validateSpace(draft: SpaceDraft): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = 'Give the space a name';
  if (!SPACE_KEY_PATTERN.test(draft.key)) {
    errors.key = 'Two to ten capital letters or digits, starting with a letter';
  }
  return errors;
}

/**
 * The create-space form: the key follows the name until the person edits it, the colour
 * is one of the space tones, and a key already in use comes back as an error on the key.
 */
export function useCreateSpace(onCreated: (space: Space) => void) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SpaceDraft>({
    name: '',
    key: '',
    description: '',
    tone: SPACE_TONES[0],
  });
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const create = useMutation({
    mutationFn: () =>
      api.docs.spaces.create({
        name: draft.name.trim(),
        key: draft.key,
        color: draft.tone,
        ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      }),
    onSuccess: (space) => {
      void queryClient.invalidateQueries({ queryKey: docsKeys.spaces() });
      onCreated(space);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'conflict') {
        setErrors({ key: `${draft.key} is already a space key` });
      } else setErrors({ form: error.message });
    },
  });

  return {
    draft,
    errors,
    isSubmitting: create.isPending,
    setName: (name: string) => {
      setDraft((current) => ({ ...current, name, key: keyTouched ? current.key : suggestKey(name) }));
      setErrors(({ name: _name, ...rest }) => rest);
    },
    setKey: (key: string) => {
      setKeyTouched(true);
      setDraft((current) => ({ ...current, key: key.toUpperCase().replace(/[^A-Z0-9]/g, '') }));
      setErrors(({ key: _key, ...rest }) => rest);
    },
    setDescription: (description: string) => setDraft((current) => ({ ...current, description })),
    setTone: (tone: SpaceTone) => setDraft((current) => ({ ...current, tone })),
    submit: () => {
      const found = validateSpace(draft);
      setErrors(found);
      if (Object.keys(found).length === 0 && !create.isPending) create.mutate();
    },
  };
}
