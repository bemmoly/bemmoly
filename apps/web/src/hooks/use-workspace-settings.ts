import { languageName } from '@bemmoly/core-web';
import { SETTING_SCHEMAS, SHIPPED_LOCALES } from '@bemmoly/shared';
import { useState } from 'react';
import { z } from 'zod';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import { useDraft, useSettings, valuesOf } from './use-setting.ts';

/** The languages Bemmoly ships, each named in its own words (ADR 0024). */
export const LOCALES = SHIPPED_LOCALES.map((value) => ({ value, label: languageName(value) }));

const KEYS = ['workspace.name', 'workspace.url', 'workspace.locale', 'workspace.timezone'] as const;

const formSchema = z.object({
  name: SETTING_SCHEMAS['workspace.name'],
  locale: SETTING_SCHEMAS['workspace.locale'],
  timezone: SETTING_SCHEMAS['workspace.timezone'],
});

interface WorkspaceForm {
  name: string;
  url: string;
  locale: string;
  timezone: string;
}

/** Workspace details: name, URL (read-only, from the server's public URL), locale, timezone. */
export function useWorkspaceSettings() {
  const settings = useSettings(KEYS, 'Workspace details saved');
  const stored = settings.reads ? valuesOf(settings.reads) : undefined;
  const draft = useDraft<WorkspaceForm>(
    stored && {
      name: stored['workspace.name'] ?? '',
      url: stored['workspace.url'] ?? window.location.origin,
      locale: stored['workspace.locale'] ?? 'en',
      timezone: stored['workspace.timezone'] ?? 'UTC',
    },
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Checks and writes the draft; `onSaved` returns the section to its read view. */
  const save = (onSaved: () => void = () => {}) => {
    const result = validateForm(formSchema, draft.value);
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    settings.save.mutate(
      {
        'workspace.name': result.data.name,
        'workspace.locale': result.data.locale,
        'workspace.timezone': result.data.timezone,
      },
      {
        onSuccess: () => {
          draft.discard();
          onSaved();
        },
      },
    );
  };
  const discard = () => {
    draft.discard();
    setErrors({});
  };
  return { settings, draft, errors, save, discard };
}
