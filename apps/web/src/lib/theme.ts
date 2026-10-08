import type { Appearance } from './appearance.ts';
import { PRESETS, type PresetId } from '@bemmoly/ui/tokens';
import { buildTheme, type BuiltTheme } from '@bemmoly/ui/theme';

/**
 * "system" is no personal choice (the menu's "Workspace default"): the
 * workspace look, or Classic light before one exists. It never follows the OS.
 */
export type PersonalMode = 'system' | 'light' | 'dark';

export interface PersonalTheme {
  mode: PersonalMode;
  preset: PresetId | null;
}

export type ResolvedAppearance =
  | { kind: 'preset'; id: PresetId; mode: 'light' | 'dark' }
  | { kind: 'custom'; theme: BuiltTheme; mode: 'light' | 'dark' };

const presetById = (id: string) => PRESETS.find((preset) => preset.id === id);

function fromPreset(id: string, mode?: 'light' | 'dark'): ResolvedAppearance {
  const preset = presetById(id) ?? PRESETS[0];
  if (!mode || preset.mode === mode) return { kind: 'preset', id: preset.id, mode: preset.mode };
  if (preset.id === 'light' || preset.id === 'dark')
    return fromPreset(mode === 'dark' ? 'dark' : 'light');
  const theme = buildTheme({
    brand: preset.accent[0],
    mode,
    surfaces: 'neutral',
    font: preset.font,
  });
  return { kind: 'custom', theme, mode };
}

/**
 * What this person sees: the workspace look, then their own light/dark choice
 * when the policy allows it, then their own preset when personal themes are on.
 * Before a workspace look exists (setup, sign-in) only an explicit personal
 * choice applies, and with none the page is Classic light whatever the OS says.
 */
export function resolveAppearance(
  appearance: Appearance | undefined,
  personal: PersonalTheme,
): ResolvedAppearance {
  if (!appearance) {
    if (personal.preset) return fromPreset(personal.preset);
    return fromPreset(personal.mode === 'dark' ? 'dark' : 'light');
  }
  if (appearance.policy.personalThemes && personal.preset) return fromPreset(personal.preset);
  const override =
    appearance.policy.memberModeSwitch && personal.mode !== 'system' ? personal.mode : undefined;
  if (appearance.preset === 'custom' && appearance.custom) {
    const custom = { ...appearance.custom, mode: override ?? appearance.custom.mode };
    const theme = buildTheme({
      brand: custom.brandColor,
      mode: custom.mode,
      surfaces: custom.surfaces,
      font: custom.font,
    });
    return { kind: 'custom', theme, mode: custom.mode };
  }
  return fromPreset(appearance.preset, override);
}
