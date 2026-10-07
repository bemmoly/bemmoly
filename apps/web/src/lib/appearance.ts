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

/** The data kernel names the Classic preset "classic"; the design tokens call it "light". */
export const SERVER_CLASSIC = 'classic';

export const DEFAULT_APPEARANCE: Appearance = {
  preset: 'light',
  custom: null,
  logoKey: null,
  policy: { memberModeSwitch: true, personalThemes: false },
};

export function appearanceFrom(reads: Reads): Appearance {
  const stored = reads['appearance.theme']?.value ?? DEFAULT_APPEARANCE.preset;
  const preset = stored === SERVER_CLASSIC ? 'light' : stored;
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

/**
 * The keys and values to write for an appearance; the font follows the preset
 * unless custom. A preset writes no brand colour (the key holds hex only), so
 * the last custom brand is still there when someone returns to Custom.
 */
export function appearanceWrites(appearance: Appearance, presetFont: string) {
  const custom = appearance.custom;
  return [
    ['appearance.theme', appearance.preset === 'light' ? SERVER_CLASSIC : appearance.preset],
    ...(custom ? ([['appearance.brandColor', custom.brandColor]] as const) : []),
    ['appearance.font', custom?.font ?? presetFont],
    ['appearance.mode', custom?.mode ?? 'light'],
    ['appearance.surfaces', custom?.surfaces ?? 'neutral'],
    ['appearance.memberModeSwitch', appearance.policy.memberModeSwitch],
    ['appearance.personalThemes', appearance.policy.personalThemes],
  ] as const;
}
