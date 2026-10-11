import type { CustomThemeRecord, ModePreference, SettingKey, SettingValue } from '@bemmoly/shared';
import { FONT_IDS, RETIRED_PRESETS, type FontId } from '@bemmoly/ui/tokens';

/** The workspace look, assembled from the appearance.* settings keys (ADR 0021). */
export interface Appearance {
  /** A built-in theme id, or "custom" with customThemeId naming which. */
  theme: string;
  customThemeId: string | null;
  defaultMode: ModePreference;
  font: FontId;
  logoKey: string | null;
  /** The workspace's own custom themes. */
  customThemes: CustomThemeRecord[];
}

export const APPEARANCE_KEYS = [
  'appearance.theme',
  'appearance.customThemeId',
  'appearance.defaultMode',
  'appearance.font',
  'appearance.logoKey',
  'appearance.brandColor',
] as const satisfies readonly SettingKey[];

export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];
type Reads = { [K in AppearanceKey]?: { value: SettingValue<K> | null | undefined } };

export const DEFAULT_APPEARANCE: Appearance = {
  theme: 'bemmoly',
  customThemeId: null,
  defaultMode: 'system',
  font: 'plex',
  logoKey: null,
  customThemes: [],
};

const isFont = (value: unknown): value is FontId => (FONT_IDS as unknown[]).includes(value);

export function appearanceFrom(reads: Reads, customThemes: CustomThemeRecord[] = []): Appearance {
  const stored = reads['appearance.theme']?.value ?? DEFAULT_APPEARANCE.theme;
  const font = reads['appearance.font']?.value;
  return {
    // A retired preset still stored (an old mock seed, a skipped migration) reads as its theme.
    theme: RETIRED_PRESETS[stored]?.theme ?? stored,
    customThemeId: reads['appearance.customThemeId']?.value ?? null,
    defaultMode: reads['appearance.defaultMode']?.value ?? DEFAULT_APPEARANCE.defaultMode,
    font: isFont(font) ? font : 'plex',
    logoKey: reads['appearance.logoKey']?.value || null,
    customThemes,
  };
}

/**
 * The keys and values to write for an appearance. A custom default also mirrors its brand into
 * appearance.brandColor, which the previous minor and emails read.
 */
export function appearanceWrites(appearance: Appearance) {
  const custom =
    appearance.theme === 'custom'
      ? appearance.customThemes.find((theme) => theme.id === appearance.customThemeId)
      : undefined;
  return [
    [
      'appearance.theme',
      custom ? 'custom' : appearance.theme === 'custom' ? 'bemmoly' : appearance.theme,
    ],
    ['appearance.customThemeId', custom ? custom.id : null],
    ...(custom ? ([['appearance.brandColor', custom.brandColor]] as const) : []),
    ['appearance.defaultMode', appearance.defaultMode],
    ['appearance.font', appearance.font],
  ] as const;
}
