import { useMemo, useState } from 'react';
import { APPEARANCE_KEYS } from '../lib/appearance.ts';
import { sourceOf } from '../lib/theme.ts';
import {
  appearanceDescription,
  draftFrom,
  draftPreview,
  draftWrites,
  type AppearanceDraft,
} from './use-appearance-draft.ts';
import { useMe } from './use-session.ts';
import { useDraft, useSettings } from './use-setting.ts';
import { themeOptions } from './use-theme-options.ts';
import { useThemePreview } from './use-theme-preview.ts';
import { useWorkspace } from './use-workspace.ts';

export type PreviewView = 'board' | 'doc' | 'login';

export const PREVIEW_VIEWS = [
  { value: 'board', label: 'Board' },
  { value: 'doc', label: 'Doc' },
  { value: 'login', label: 'Login' },
] as const;

export const NO_APPEARANCE_PERMISSION =
  'Only people who can set appearance and themes can change these.';

/**
 * Settings › Appearance: a draft of the workspace look (theme, default mode and typeface),
 * previewed on the whole page while it differs from what is stored,
 * and saved for everyone. Discard or leaving the page returns to the saved look.
 */
export function useAppearance() {
  const me = useMe();
  const canManage = me.can('workspace.appearance.manage');
  const workspace = useWorkspace();
  const customThemes = workspace.appearance.customThemes;
  const settings = useSettings(APPEARANCE_KEYS, 'Appearance saved for the workspace');
  const draft = useDraft<AppearanceDraft>(
    settings.reads && draftFrom(settings.reads, customThemes),
  );
  const [view, setView] = useState<PreviewView>('board');
  const value = draft.value;
  const dirty = draft.dirty;
  useThemePreview(
    useMemo(
      () => (dirty && value ? draftPreview(value, customThemes) : null),
      [dirty, value, customThemes],
    ),
  );

  const submit = () => {
    if (!canManage || !value) return;
    settings.save.mutate(draftWrites(value, customThemes), { onSuccess: draft.discard });
  };

  return {
    settings,
    canManage,
    workspaceName: workspace.name,
    /** The preview draws its AI samples only while AI is on, as the app does. */
    aiEnabled: workspace.aiEnabled,
    draft,
    value,
    description: appearanceDescription(workspace.name),
    options: themeOptions(customThemes),
    source: value ? sourceOf(value.theme, customThemes) : null,
    update: (patch: Partial<AppearanceDraft>) => draft.update(patch),
    preview: { view, setView },
    discard: draft.discard,
    submit,
  };
}

export type AppearanceState = ReturnType<typeof useAppearance>;
