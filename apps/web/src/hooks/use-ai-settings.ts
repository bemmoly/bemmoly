import { useState } from 'react';
import { LOCAL_AI, NO_AI, useSetupStore, type AiChoice } from '../store/setup.ts';
import { connectionShell, useAiCatalog } from './use-ai-catalog.ts';
import { useMe } from './use-session.ts';
import { useDraft, useSettings, valuesOf } from './use-setting.ts';

export const AI_KEYS = ['ai.providerId', 'ai.shareContent', 'ai.allowActions'] as const;

export interface AiForm {
  /** A catalog id, "local", or null for no AI. */
  providerId: string | null;
  shareContent: boolean;
  allowActions: boolean;
}

/** The two privacy rows that save, and the exclusion row that waits for Docs. */
export const PRIVACY_ROWS = {
  shareContent: {
    label: 'Send issue and doc content to the provider',
    hint: 'Required for summaries and Q&A. Off means AI only sees titles and metadata.',
  },
  allowActions: {
    label: 'Let AI actions change data',
    hint: 'Always previewed and confirmed by a person. Logged in the audit trail.',
  },
  excludeSpaces: {
    label: 'Exclude spaces',
    hint: 'Pages in excluded spaces are never sent. Set per space later.',
    action: 'Choose',
    disabledReason: 'Spaces arrive with the Docs module',
  },
} as const;

export const NO_AI_OPTION = {
  id: NO_AI,
  name: 'No AI for now',
  description: 'Everything else works. You can connect a provider any time.',
} as const;

export const LOCAL_DESCRIPTION =
  'Runs on your hardware. Nothing leaves the network. Needs a GPU for good speed.';

/** Model roles the AI runtime fills; listed now so the page shape does not change later. */
export const MODEL_ROLES = [
  { id: 'fast', label: 'Fast' },
  { id: 'standard', label: 'Standard' },
  { id: 'strong', label: 'Strong' },
  { id: 'embedding', label: 'Embedding' },
].map((role) => ({ ...role, status: 'Available with the AI runtime' }));

export const UPLOAD_NOTE =
  'Uploading a newer catalog file arrives with the AI runtime in a later release.';

export const NO_PERMISSION_NOTE = 'Only people who can configure AI models can change these.';

/** The picker's choice as the stored ai.providerId. */
export function providerIdOf(choice: AiChoice | null): string | null {
  return !choice || choice === NO_AI ? null : choice;
}

/** A stored ai.providerId as the picker's choice. */
export function choiceOf(providerId: string | null | undefined): AiChoice {
  return providerId ?? NO_AI;
}

/** The setting values written by both the wizard and Settings › AI. */
export function aiSettingValues(form: { ai: AiChoice } & Omit<AiForm, 'providerId'>) {
  return {
    'ai.providerId': providerIdOf(form.ai),
    'ai.shareContent': form.shareContent,
    'ai.allowActions': form.allowActions,
  };
}

/** The Done step's AI line: provider, then the two privacy choices in words. */
export function aiSummary(providerName: string | null, form: Omit<AiForm, 'providerId'>): string {
  if (!providerName) return NO_AI_OPTION.name;
  const content = form.shareContent ? 'content sharing on' : 'titles and metadata only';
  const actions = form.allowActions ? 'actions require confirmation' : 'AI actions off';
  return [providerName, content, actions].join(' · ');
}

/** The picker, selection and connection form shell for one chosen id. */
function usePicker(choice: AiChoice) {
  const [query, setQuery] = useState('');
  const catalog = useAiCatalog(query);
  const selected = catalog.find(providerIdOf(choice));
  return {
    query,
    setQuery,
    ...catalog,
    selected,
    connection: selected && selected.id !== LOCAL_AI ? connectionShell(selected) : null,
    isLocal: choice === LOCAL_AI,
  };
}

/** Step 4: the choice lives in the wizard store until "Save AI settings". */
export function useSetupAi(onSaved: () => void | Promise<void>) {
  const ai = useSetupStore((state) => state.ai);
  const shareContent = useSetupStore((state) => state.shareContent);
  const allowActions = useSetupStore((state) => state.allowActions);
  const update = useSetupStore((state) => state.update);
  const settings = useSettings(AI_KEYS, 'AI settings saved');
  const picker = usePicker(ai);
  return {
    choice: ai,
    pick: (choice: AiChoice) => update({ ai: choice }),
    shareContent,
    setShareContent: (value: boolean) => update({ shareContent: value }),
    allowActions,
    setAllowActions: (value: boolean) => update({ allowActions: value }),
    picker,
    save: settings.save,
    submit: () =>
      settings.save.mutate(aiSettingValues({ ai, shareContent, allowActions }), {
        onSuccess: () => {
          update({ aiSaved: true });
          void onSaved();
        },
      }),
  };
}

/** Settings › AI and models: provider choice and the two privacy toggles save; the rest waits. */
export function useAiSettings() {
  const me = useMe();
  const canConfigure = me.can('ai.models.configure');
  const settings = useSettings(AI_KEYS, 'AI settings saved');
  const stored = settings.reads ? valuesOf(settings.reads) : undefined;
  const draft = useDraft<AiForm>(
    stored && {
      providerId: stored['ai.providerId'] ?? null,
      shareContent: stored['ai.shareContent'] ?? true,
      allowActions: stored['ai.allowActions'] ?? true,
    },
  );
  const value = draft.value;
  const choice = choiceOf(value?.providerId);
  const picker = usePicker(choice);
  const submit = () => {
    if (!canConfigure || !value) return;
    settings.save.mutate(aiSettingValues({ ...value, ai: choice }), {
      onSuccess: () => draft.discard(),
    });
  };
  return {
    settings,
    canConfigure,
    disabledReason: canConfigure ? null : NO_PERMISSION_NOTE,
    draft,
    choice,
    pick: (next: AiChoice) => draft.update({ providerId: providerIdOf(next) }),
    picker,
    modelRoles: MODEL_ROLES,
    uploadNote: UPLOAD_NOTE,
    submit,
  };
}
