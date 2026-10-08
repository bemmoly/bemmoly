import type { ThemeFont } from '@bemmoly/shared';
import { PRESETS, type PresetId } from '@bemmoly/ui/tokens';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { presetLook } from '../lib/theme.ts';
import { useSetupStore } from '../store/setup.ts';
import { useSettings } from './use-setting.ts';
import { clearThemePreview, useThemePreview } from './use-theme-preview.ts';
import { workspaceQuery } from './use-workspace.ts';

export const THEME_KEYS = ['appearance.theme', 'appearance.font'] as const;

/** The server names the Classic preset "classic"; the token package calls it "light". */
const SERVER_ID: Partial<Record<PresetId, string>> = { light: 'classic' };

export const CUSTOM_THEME_LINK = {
  label: 'Build a custom theme with your brand color instead →',
  to: '/settings/appearance',
} as const;

export interface ThemeChoice {
  id: PresetId;
  name: string;
  mode: 'light' | 'dark';
  font: ThemeFont;
}

/** The eight presets in the token package's order, as the wizard's tiles. */
export const THEME_CHOICES: readonly ThemeChoice[] = PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  mode: preset.mode,
  font: preset.font,
}));

/** The appearance.theme value for a token preset id. */
export function themeSettingId(id: PresetId): string {
  return SERVER_ID[id] ?? id;
}

/** A stored appearance.theme as a token preset id; unknown values fall back to Classic. */
export function presetIdFromSetting(value: string | null | undefined): PresetId {
  const entry = Object.entries(SERVER_ID).find(([, server]) => server === value);
  if (entry) return entry[0] as PresetId;
  return THEME_CHOICES.find((choice) => choice.id === value)?.id ?? 'light';
}

export function themeChoice(id: PresetId): ThemeChoice {
  return THEME_CHOICES.find((choice) => choice.id === id) ?? (THEME_CHOICES[0] as ThemeChoice);
}

/** The settings written on "Finish setup": the preset and the font it ships with. */
export function themeSettingValues(id: PresetId) {
  return { 'appearance.theme': themeSettingId(id), 'appearance.font': themeChoice(id).font };
}

/** The Done step's theme line. */
export function themeSummary(id: PresetId, saved: boolean): string {
  if (!saved) return 'Skipped · the default theme stays';
  return `${themeChoice(id).name} · members may switch light/dark`;
}

/**
 * Swaps the preview for the saved look without a flash: the workspace look is
 * loaded into the cache the theme reads first, so dropping the preview leaves
 * the same preset on screen. A failed load still drops the preview; the saved
 * look then applies on the next page load.
 */
async function handOverToSavedLook(queryClient: QueryClient): Promise<void> {
  await queryClient.fetchQuery(workspaceQuery).catch(() => undefined);
  clearThemePreview();
}

/**
 * Step 5: pick a preset tile and the whole page shows it at once; "Finish
 * setup" saves it and moves to the summary. Leaving the step any other way
 * (Skip, the rail, Back, a reload elsewhere) drops the preview.
 */
export function useSetupAppearance(onSaved: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const selected = useSetupStore((state) => state.theme);
  const update = useSetupStore((state) => state.update);
  const settings = useSettings(THEME_KEYS, 'Theme saved');
  useThemePreview(useMemo(() => presetLook(selected), [selected]));
  return {
    choices: THEME_CHOICES,
    selected,
    select: (id: PresetId) => update({ theme: id }),
    customLink: CUSTOM_THEME_LINK,
    save: settings.save,
    submit: () =>
      settings.save.mutate(themeSettingValues(selected), {
        onSuccess: async () => {
          await handOverToSavedLook(queryClient);
          update({ themeSaved: true });
          void onSaved();
        },
      }),
  };
}
