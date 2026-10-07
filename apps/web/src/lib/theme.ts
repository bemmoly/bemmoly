import type { Appearance } from './appearance.ts';
import { PRESETS, type PresetId } from '@bemmoly/ui/tokens';
import { buildTheme, type BuiltTheme } from '../components/placeholders/theme.ts';

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
    brandColor: preset.accent[0],
    mode,
    surfaces: 'neutral',
    font: preset.font,
  });
  return { kind: 'custom', theme, mode };
}

/**
 * What this person sees: the workspace look, then their own light/dark choice
 * when the policy allows it, then their own preset when personal themes are on.
 * Signed out, only the personal choice applies ("system" follows the OS).
 */
export function resolveAppearance(
  appearance: Appearance | undefined,
  personal: PersonalTheme,
  prefersDark: boolean,
): ResolvedAppearance {
  if (!appearance) {
    if (personal.preset) return fromPreset(personal.preset);
    const mode = personal.mode === 'system' ? (prefersDark ? 'dark' : 'light') : personal.mode;
    return fromPreset(mode === 'dark' ? 'dark' : 'light');
  }
  if (appearance.policy.personalThemes && personal.preset) return fromPreset(personal.preset);
  const override =
    appearance.policy.memberModeSwitch && personal.mode !== 'system' ? personal.mode : undefined;
  if (appearance.preset === 'custom' && appearance.custom) {
    const custom = { ...appearance.custom, mode: override ?? appearance.custom.mode };
    return { kind: 'custom', theme: buildTheme(custom), mode: custom.mode };
  }
  return fromPreset(appearance.preset, override);
}
