import { contrastCheck } from '@bemmoly/ui/theme';
import { useMemo, useState } from 'react';
import { APPEARANCE_KEYS } from '../lib/appearance.ts';
import {
  appearanceDescription,
  CUSTOM,
  draftFrom,
  draftLook,
  draftWrites,
  HEX_ERROR,
  normalizeHex,
  previewLabel,
  themeOptions,
  themeScope,
  type AppearanceDraft,
} from './use-appearance-draft.ts';
import { useMe } from './use-session.ts';
import { useDraft, useSettings } from './use-setting.ts';
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

type CustomPatch = Partial<Pick<AppearanceDraft, 'brand' | 'mode' | 'surfaces' | 'font'>>;

/**
 * Settings › Appearance: a draft of the workspace look, previewed on the whole
 * page while it differs from what is stored, and saved for everyone. Saving
 * refetches the workspace look before the draft is dropped, so the saved look
 * takes over from the preview with no flash; Discard or leaving the page
 * returns to the saved look.
 */
export function useAppearance() {
  const me = useMe();
  const canManage = me.can('workspace.appearance.manage');
  const workspace = useWorkspace();
  const settings = useSettings(APPEARANCE_KEYS, 'Appearance saved for the workspace');
  const draft = useDraft<AppearanceDraft>(settings.reads && draftFrom(settings.reads));
  const [hexText, setHexText] = useState<string | null>(null);
  const [view, setView] = useState<PreviewView>('board');
  const value = draft.value;
  const dirty = draft.dirty;
  useThemePreview(useMemo(() => (dirty && value ? draftLook(value) : null), [dirty, value]));

  // Editing the builder means building a custom theme, so it selects Custom.
  const editCustom = (patch: CustomPatch) => draft.update({ ...patch, preset: CUSTOM });
  const typeHex = (text: string) => {
    setHexText(text);
    const hex = normalizeHex(text);
    if (hex) editCustom({ brand: hex });
  };
  const pickBrand = (brand: string) => {
    setHexText(null);
    editCustom({ brand });
  };
  const discard = () => {
    setHexText(null);
    draft.discard();
  };
  const submit = () => {
    if (!canManage || !value) return;
    settings.save.mutate(draftWrites(value), { onSuccess: discard });
  };

  return {
    settings,
    canManage,
    workspaceName: workspace.name,
    draft,
    value,
    isCustom: value?.preset === CUSTOM,
    description: appearanceDescription(workspace.name, value?.memberModeSwitch ?? true),
    options: value ? themeOptions(value) : [],
    selectTheme: (preset: string) => draft.update({ preset }),
    pickBrand,
    hex: {
      text: hexText ?? value?.brand ?? '',
      error: hexText !== null && !normalizeHex(hexText) ? HEX_ERROR : null,
      onChange: typeHex,
    },
    setMode: (mode: AppearanceDraft['mode']) => editCustom({ mode }),
    setSurfaces: (surfaces: AppearanceDraft['surfaces']) => editCustom({ surfaces }),
    setFont: (font: AppearanceDraft['font']) => editCustom({ font }),
    setPolicy: (patch: Partial<Pick<AppearanceDraft, 'memberModeSwitch' | 'personalThemes'>>) =>
      draft.update(patch),
    contrast: value ? contrastCheck(value.brand).message : '',
    preview: {
      view,
      setView,
      label: value ? previewLabel(value) : '',
      scope: value ? themeScope(value) : {},
    },
    discard,
    submit,
  };
}

export type AppearanceState = ReturnType<typeof useAppearance>;
