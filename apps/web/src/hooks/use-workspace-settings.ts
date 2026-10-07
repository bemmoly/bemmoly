import { SETTING_SCHEMAS } from '@bemmoly/shared';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import { validateForm, type FieldErrors } from '../lib/errors.ts';
import { useDraft, useSettings, valuesOf } from './use-setting.ts';

export const TIMEZONES = Intl.supportedValuesOf('timeZone');

export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
];

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
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = validateForm(formSchema, draft.value);
    if (result.errors) return setErrors(result.errors);
    setErrors({});
    settings.save.mutate(
      {
        'workspace.name': result.data.name,
        'workspace.locale': result.data.locale,
        'workspace.timezone': result.data.timezone,
      },
      { onSuccess: () => draft.discard() },
    );
  };
  return { settings, draft, errors, submit };
}
