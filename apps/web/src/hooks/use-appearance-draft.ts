import type { SurfaceTone, ThemeFont, ThemeMode } from '@bemmoly/shared';
import { buildTheme, themeStyle } from '@bemmoly/ui/theme';
import { PRESETS } from '@bemmoly/ui/tokens';
import type { CSSProperties } from 'react';
import { DEFAULT_BRAND } from '../components/appearance/brand-choices.ts';
import { presetTileColors, type TileColors } from '../components/appearance/theme-tile.tsx';
import {
  appearanceFrom,
  appearanceWrites,
  type Appearance,
  type AppearanceKey,
} from '../lib/appearance.ts';
import type { SettingReads, SettingValues } from './use-setting.ts';

export const CUSTOM = 'custom';

/** Everything the Appearance page edits; the custom builder's inputs survive picking a preset. */
export interface AppearanceDraft {
  /** A token preset id ("light" is Classic), or "custom". */
  preset: string;
  brand: string;
  mode: ThemeMode;
  surfaces: SurfaceTone;
  font: ThemeFont;
  memberModeSwitch: boolean;
  personalThemes: boolean;
}

export interface ThemeOption {
  id: string;
  name: string;
  mode: 'Light' | 'Dark';
  colors: TileColors;
}

/** What the preview container carries: a preset's data-theme, or the built custom tokens. */
export interface ThemeScope {
  'data-theme'?: string;
  style?: CSSProperties;
}

const isPreset = (id: string) => PRESETS.some((preset) => preset.id === id);
const modeLabel = (mode: ThemeMode): ThemeOption['mode'] => (mode === 'dark' ? 'Dark' : 'Light');

export function draftFrom(reads: SettingReads<AppearanceKey>): AppearanceDraft {
  const appearance = appearanceFrom(reads);
  const preset =
    appearance.preset === CUSTOM || isPreset(appearance.preset) ? appearance.preset : 'light';
  return {
    preset,
    brand: appearance.custom?.brandColor ?? reads['appearance.brandColor'].value ?? DEFAULT_BRAND,
    mode: appearance.custom?.mode ?? reads['appearance.mode'].value ?? 'light',
    surfaces: appearance.custom?.surfaces ?? reads['appearance.surfaces'].value ?? 'neutral',
    font: appearance.custom?.font ?? reads['appearance.font'].value ?? 'plex',
    memberModeSwitch: appearance.policy.memberModeSwitch,
    personalThemes: appearance.policy.personalThemes,
  };
}

export function toAppearance(draft: AppearanceDraft): Appearance {
  return {
    preset: draft.preset,
    custom:
      draft.preset === CUSTOM
        ? { brandColor: draft.brand, mode: draft.mode, surfaces: draft.surfaces, font: draft.font }
        : null,
    logoKey: null,
    policy: { memberModeSwitch: draft.memberModeSwitch, personalThemes: draft.personalThemes },
  };
}

/** The settings to write for the draft. */
export function draftWrites(draft: AppearanceDraft): SettingValues<AppearanceKey> {
  const presetFont = PRESETS.find((preset) => preset.id === draft.preset)?.font ?? draft.font;
  const writes = appearanceWrites(toAppearance(draft), presetFont);
  return Object.fromEntries(writes) as SettingValues<AppearanceKey>;
}

/** "#F97316", " f97316 " and "#f97316" all mean the same brand; anything else is not a colour. */
export function normalizeHex(text: string): string | null {
  const trimmed = text.trim();
  const hex = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : null;
}

export const HEX_ERROR = 'Use six hex digits, like #f97316.';

/** The eight presets in the token package's order, then Custom painted with the draft. */
export function themeOptions(draft: AppearanceDraft): ThemeOption[] {
  const presets = PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    mode: modeLabel(preset.mode),
    colors: presetTileColors(preset.id),
  }));
  const base = presetTileColors(draft.mode === 'dark' ? 'dark' : 'light');
  return [
    ...presets,
    {
      id: CUSTOM,
      name: 'Custom',
      mode: modeLabel(draft.mode),
      colors: { ...base, ac: draft.brand },
    },
  ];
}

export function previewLabel(draft: AppearanceDraft): string {
  if (draft.preset === CUSTOM) return `Custom · ${draft.brand} · ${draft.mode}`;
  const preset = PRESETS.find((entry) => entry.id === draft.preset) ?? PRESETS[0];
  return `${preset.name} preset`;
}

/** React wants camelCase for ordinary properties; custom properties keep their names. */
function reactStyle(style: Record<string, string>): CSSProperties {
  return Object.fromEntries(
    Object.entries(style).map(([name, value]) => [
      name.startsWith('--')
        ? name
        : name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  ) as CSSProperties;
}

export function themeScope(draft: AppearanceDraft): ThemeScope {
  if (draft.preset !== CUSTOM) return { 'data-theme': draft.preset };
  const theme = buildTheme({
    brand: draft.brand,
    mode: draft.mode,
    surfaces: draft.surfaces,
    font: draft.font,
  });
  return { style: reactStyle(themeStyle(theme)) };
}

/** The page description: the mock's second sentence is only true while members may switch. */
export function appearanceDescription(workspaceName: string, memberModeSwitch: boolean): string {
  const first = `Sets the default look for everyone in ${workspaceName}.`;
  return memberModeSwitch
    ? `${first} People can still choose light or dark for themselves in their profile.`
    : first;
}
