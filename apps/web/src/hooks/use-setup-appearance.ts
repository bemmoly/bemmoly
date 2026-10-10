import type { ThemeFont } from '@bemmoly/shared';
import { PRESETS, type PresetId } from '@bemmoly/ui/tokens';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSetupStore, type CustomThemeDraft } from '../store/setup.ts';
import {
  CUSTOM,
  draftLook,
  draftWrites,
  themeScope,
  type AppearanceDraft,
} from './use-appearance-draft.ts';
import { useSetupCustomTheme } from './use-setup-custom-theme.ts';
import { useSettings, type SettingValues } from './use-setting.ts';
import { clearThemePreview, useThemePreview } from './use-theme-preview.ts';
import { useWorkspace, workspaceQuery } from './use-workspace.ts';

/** What the Look step writes: the preset and its font, or the custom build's four inputs. */
export const THEME_KEYS = [
  'appearance.theme',
  'appearance.font',
  'appearance.brandColor',
  'appearance.mode',
  'appearance.surfaces',
] as const;

type ThemeKey = (typeof THEME_KEYS)[number];

/** The server names the Classic preset "classic"; the token package calls it "light". */
const SERVER_ID: Partial<Record<PresetId, string>> = { light: 'classic' };

/** The brand color's toggle: it switches to the custom build in place, then offers the way back. */
export const CUSTOM_THEME_TOGGLE = {
  open: 'Use your brand color',
  close: 'Use a preset instead',
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

/**
 * The step's choice in the Appearance page's draft shape, so the wizard previews and
 * saves a custom theme exactly as Settings › Appearance does. The policy keeps its defaults.
 */
export function setupThemeDraft(
  theme: PresetId,
  useCustom: boolean,
  custom: CustomThemeDraft,
): AppearanceDraft {
  return {
    preset: useCustom ? CUSTOM : theme,
    ...custom,
    memberModeSwitch: true,
    personalThemes: false,
  };
}

/** The settings "Finish setup" writes for the step's choice. */
export function setupThemeWrites(draft: AppearanceDraft): SettingValues<ThemeKey> {
  if (draft.preset !== CUSTOM) return themeSettingValues(draft.preset as PresetId);
  const writes = draftWrites(draft);
  return Object.fromEntries(THEME_KEYS.map((key) => [key, writes[key]])) as SettingValues<ThemeKey>;
}

/** The Done step's theme line. */
export function themeSummary(
  id: PresetId,
  saved: boolean,
  custom: CustomThemeDraft | null = null,
): string {
  if (!saved) return 'Skipped · the default theme stays';
  const name = custom ? `Custom · ${custom.brand} · ${custom.mode}` : themeChoice(id).name;
  return `${name} · members may switch light/dark`;
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
 * The Look step: pick a preset tile, or use the brand color under the tiles, and
 * the whole page shows the choice at once; "Finish setup" saves it and moves
 * to the summary. Picking a tile again closes the builder and keeps what was
 * built. Leaving the step any other way (Skip, the rail, Back, a reload
 * elsewhere) drops the preview.
 */
export function useSetupAppearance(onSaved: () => void | Promise<void>) {
  const queryClient = useQueryClient();
  const selected = useSetupStore((state) => state.theme);
  const useCustom = useSetupStore((state) => state.useCustomTheme);
  const customTheme = useSetupStore((state) => state.customTheme);
  const update = useSetupStore((state) => state.update);
  const settings = useSettings(THEME_KEYS, 'Theme saved');
  const custom = useSetupCustomTheme(customTheme, (patch) =>
    update({ customTheme: { ...customTheme, ...patch } }),
  );
  const draft = useMemo(
    () => setupThemeDraft(selected, useCustom, customTheme),
    [selected, useCustom, customTheme],
  );
  useThemePreview(useMemo(() => draftLook(draft), [draft]));
  return {
    choices: THEME_CHOICES,
    /** The selected tile; none while the custom builder is open. */
    selected: useCustom ? null : selected,
    select: (id: PresetId) => update({ theme: id, useCustomTheme: false }),
    customOpen: useCustom,
    toggleCustom: () => update({ useCustomTheme: !useCustom }),
    toggleLabel: useCustom ? CUSTOM_THEME_TOGGLE.close : CUSTOM_THEME_TOGGLE.open,
    draft,
    custom,
    /** Picking a swatch or typing a colour is choosing the brand color: it turns custom on. */
    brand: {
      pick: (brand: string) => {
        custom.pickBrand(brand);
        if (!useCustom) update({ useCustomTheme: true });
      },
      hex: {
        ...custom.hex,
        onChange: (text: string) => {
          custom.hex.onChange(text);
          if (!useCustom) update({ useCustomTheme: true });
        },
      },
    },
    /** The custom build's own scope, so its miniature shows it before it is chosen. */
    customScope: themeScope(setupThemeDraft(selected, true, customTheme)),
    /** The builder's logo tile paints with the draft, as on the Appearance page. */
    scope: themeScope(draft),
    workspaceName: useWorkspace().name,
    save: settings.save,
    submit: () =>
      settings.save.mutate(setupThemeWrites(draft), {
        onSuccess: async () => {
          await handOverToSavedLook(queryClient);
          update({ themeSaved: true });
          void onSaved();
        },
      }),
  };
}
