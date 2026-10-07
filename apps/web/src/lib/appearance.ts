import type { CustomTheme, SettingKey, SettingValue } from '@bemmoly/shared';

/** The workspace look, assembled from the appearance.* settings keys. */
export interface Appearance {
  /** A preset id, or "custom". */
  preset: string;
  custom: CustomTheme | null;
  logoKey: string | null;
  policy: { memberModeSwitch: boolean; personalThemes: boolean };
}

export const APPEARANCE_KEYS = [
  'appearance.theme',
  'appearance.brandColor',
  'appearance.font',
  'appearance.logoKey',
  'appearance.mode',
  'appearance.surfaces',
  'appearance.memberModeSwitch',
  'appearance.personalThemes',
] as const satisfies readonly SettingKey[];

export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];
type Reads = { [K in AppearanceKey]?: { value: SettingValue<K> | undefined } };

export const DEFAULT_APPEARANCE: Appearance = {
  preset: 'light',
  custom: null,
  logoKey: null,
  policy: { memberModeSwitch: true, personalThemes: false },
};

export function appearanceFrom(reads: Reads): Appearance {
  const preset = reads['appearance.theme']?.value ?? DEFAULT_APPEARANCE.preset;
  const brandColor = reads['appearance.brandColor']?.value ?? null;
  return {
    preset,
    custom:
      preset === 'custom' && brandColor
        ? {
            brandColor,
            mode: reads['appearance.mode']?.value ?? 'light',
            surfaces: reads['appearance.surfaces']?.value ?? 'neutral',
            font: reads['appearance.font']?.value ?? 'plex',
          }
        : null,
    logoKey: reads['appearance.logoKey']?.value ?? null,
    policy: {
      memberModeSwitch: reads['appearance.memberModeSwitch']?.value ?? true,
      personalThemes: reads['appearance.personalThemes']?.value ?? false,
    },
  };
}

/** The keys and values to write for an appearance; the font follows the preset unless custom. */
export function appearanceWrites(appearance: Appearance, presetFont: string) {
  const custom = appearance.custom;
  return [
    ['appearance.theme', appearance.preset],
    ['appearance.brandColor', custom?.brandColor ?? null],
    ['appearance.font', custom?.font ?? presetFont],
    ['appearance.mode', custom?.mode ?? 'light'],
    ['appearance.surfaces', custom?.surfaces ?? 'neutral'],
    ['appearance.memberModeSwitch', appearance.policy.memberModeSwitch],
    ['appearance.personalThemes', appearance.policy.personalThemes],
  ] as const;
}
