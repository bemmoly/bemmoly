import { queryKeys } from '@bemmoly/api-client';
import type { ModePreference } from '@bemmoly/shared';
import { customThemeSource } from '@bemmoly/ui/theme';
import { THEME_SOURCES, themeSource, type ThemeId } from '@bemmoly/ui/tokens';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { describeError } from '../lib/errors.ts';
import { useSetupStore } from '../store/setup.ts';
import { HEX_ERROR, normalizeHex } from './use-appearance-draft.ts';
import { clearThemePreview, useThemePreview } from './use-theme-preview.ts';
import { useWorkspace, workspaceQuery } from './use-workspace.ts';

/** The five themes, as the Look step's tiles. */
export const SETUP_THEMES = THEME_SOURCES;

/** The Done step's theme line. */
export function themeSummary(
  theme: ThemeId,
  saved: boolean,
  brand: string | null,
  mode: ModePreference = 'system',
): string {
  if (!saved) return 'Skipped · the default theme stays';
  const name = brand ? `Your brand colour · ${brand}` : themeSource(theme).name;
  const modeName = { light: 'Light', dark: 'Dark', system: 'Match system' }[mode];
  return `${name} · ${modeName} by default`;
}

/**
 * Swaps the preview for the saved look without a flash: the workspace look is loaded into the
 * cache the theme reads first, so dropping the preview leaves the same theme on screen.
 */
async function handOverToSavedLook(queryClient: QueryClient): Promise<void> {
  await queryClient.fetchQuery(workspaceQuery).catch(() => undefined);
  clearThemePreview();
}

/** "Finish setup": a brand colour becomes the workspace's first custom theme and its default. */
async function saveLook(workspaceName: string, draft: ReturnType<typeof useSetupStore.getState>) {
  let theme: string = draft.theme;
  let customThemeId: string | null = null;
  if (draft.useCustomTheme) {
    const created = await api.appearance.themes.create({
      name: workspaceName.slice(0, 40) || 'Brand',
      brandColor: draft.brand,
      surface: 'neutral',
      scope: 'workspace',
    });
    theme = 'custom';
    customThemeId = created.id;
    await api.settings.put('appearance.brandColor', draft.brand);
  }
  await api.settings.put('appearance.theme', theme);
  await api.settings.put('appearance.customThemeId', customThemeId);
  await api.settings.put('appearance.defaultMode', draft.defaultMode);
}

/**
 * The Look step: pick a theme or type a brand colour, and a default mode; the whole wizard
 * shows the choice at once. "Finish setup" saves it. Leaving the step drops the preview.
 */
export function useSetupAppearance(onSaved: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const draft = useSetupStore();
  const workspaceName = useWorkspace().name;
  const [hexText, setHexText] = useState<string | null>(null);
  const source = useMemo(
    () =>
      draft.useCustomTheme
        ? customThemeSource('setup', 'Your brand colour', {
            brand: draft.brand,
            surface: 'neutral',
          })
        : themeSource(draft.theme),
    [draft.useCustomTheme, draft.brand, draft.theme],
  );
  useThemePreview(
    useMemo(() => ({ source, mode: draft.defaultMode }), [source, draft.defaultMode]),
  );
  const save = useMutation({
    mutationFn: () => saveLook(workspaceName, useSetupStore.getState()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings.all() });
      await handOverToSavedLook(queryClient);
      draft.update({ themeSaved: true });
      void onSaved();
    },
  });
  return {
    themes: SETUP_THEMES,
    selected: draft.useCustomTheme ? null : draft.theme,
    select: (theme: ThemeId) => draft.update({ theme, useCustomTheme: false }),
    custom: draft.useCustomTheme,
    brandSource: customThemeSource('setup', 'Your brand colour', {
      brand: draft.brand,
      surface: 'neutral',
    }),
    hex: {
      text: hexText ?? draft.brand,
      error: hexText !== null && !normalizeHex(hexText) ? HEX_ERROR : null,
      onChange: (text: string) => {
        setHexText(text);
        const hex = normalizeHex(text);
        if (hex) draft.update({ brand: hex, useCustomTheme: true });
      },
    },
    useBrand: () => draft.update({ useCustomTheme: true }),
    mode: draft.defaultMode,
    setMode: (defaultMode: ModePreference) => draft.update({ defaultMode }),
    workspaceName,
    save,
    error: save.error ? describeError(save.error) : null,
    submit: () => save.mutate(),
  };
}
