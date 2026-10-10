/**
 * Turns a preset (or the custom builder's inputs) into the full colour set. Presets and
 * custom themes go through the same derivations, so a token added here reaches all of them.
 */
import { mixCss, mixHex, resolveHex } from '../theme/color.ts';
import { contrastCheck, contrastRatio, darkenForWhiteText } from '../theme/contrast.ts';
import { FONTS, MONO_STACK } from './fonts.ts';
import {
  COLOR_ALIASES,
  HUES,
  type CanonicalColorToken,
  type ColorSet,
  type ElevationSet,
  type Neutrals,
  type ThemeMode,
} from './names.ts';
import { PRESETS, type PresetId, type PresetSource } from './presets.ts';
import { ELEVATIONS, HUE_PAIRS, MODE_COLORS, SCRIM, overlays, pair } from './semantic.ts';

/** Text on an accent fill. */
export const ON_ACCENT = '#fff';

/** Text on a fill too light for white: Classic's primary ink. */
export const DARK_ON_ACCENT = '#161b26';

/** The lightest (light themes) or darkest (dark themes) step of `color` toward `ink` that
 * reaches `min` against every surface. Returns `color` itself when it already does. */
export function withContrast(color: string, ink: string, surfaces: string[], min = 4.5): string {
  const passes = (c: string) => surfaces.every((s) => contrastRatio(c, s) >= min);
  if (passes(color)) return color;
  for (let keep = 98; keep >= 0; keep -= 2) {
    const step = mixHex(resolveHex(ink), 100 - keep, resolveHex(color));
    if (passes(step)) return step;
  }
  return resolveHex(ink);
}

/** Accent tints over the card: 50 is a selected row, 100 a selected border. */
export function accentTints(accent: string, mode: ThemeMode, card: string) {
  const dark = mode === 'dark';
  return {
    'acc-50': mixCss(accent, dark ? 16 : 8, card),
    'acc-100': mixCss(accent, dark ? 28 : 15, card),
  };
}

export interface ColorInputs {
  mode: ThemeMode;
  /** [accent, pressed accent, light accent]. */
  accent: readonly [string, string, string];
  neutrals: Neutrals;
  exact?: PresetSource['exact'];
  /** Fill behind on-accent text when it must differ from the accent (mid-contrast brands). */
  fill?: string;
  /** Accent used for text and lines when it must differ from the fill (light brands). */
  text?: string;
  /** Text on accent fills. */
  onAccent?: string;
}

/** The fill behind on-accent text and the text on it, following the Appearance contrast rule. */
export function accentFill(brand: string): { fill: string; onAccent: string } {
  const { level } = contrastCheck(brand);
  if (level === 'darken') return { fill: darkenForWhiteText(brand), onAccent: ON_ACCENT };
  if (level === 'dark-text') return { fill: brand, onAccent: DARK_ON_ACCENT };
  return { fill: brand, onAccent: ON_ACCENT };
}

export function resolveColors(input: ColorInputs): ColorSet {
  const { mode, neutrals: nt, exact } = input;
  const [brand, pressed, light] = input.accent;
  const surfaces = [nt.canvas, nt.side, nt.sunken, nt.card];
  const tints = accentTints(brand, mode, nt.card);
  const policy = accentFill(brand);
  const modeColors = MODE_COLORS[mode];

  const canonical: Record<CanonicalColorToken, string> = {
    canvas: nt.canvas,
    side: nt.side,
    sunken: nt.sunken,
    card: nt.card,
    ...overlays(mode, resolveHex(nt.tx)),
    line: nt.line,
    'line-2': nt['line-2'],
    tx: nt.tx,
    'tx-2': withContrast(nt['tx-2'], nt.tx, surfaces),
    'tx-3': withContrast(nt['tx-3'], nt.tx, surfaces),
    acc: input.text ?? withContrast(brand, nt.tx, surfaces),
    'acc-600': pressed,
    'acc-500': light,
    'acc-100': exact?.['acc-100'] ?? tints['acc-100'],
    'acc-50': exact?.['acc-50'] ?? tints['acc-50'],
    'acc-fill': input.fill ?? exact?.['acc-fill'] ?? policy.fill,
    'on-acc': input.onAccent ?? policy.onAccent,
    ...modeColors,
    'on-solid': '#fff',
    scrim: SCRIM,
  };

  const hues = Object.fromEntries(
    HUES.flatMap((hue) => {
      const [bg, fg] = pair(HUE_PAIRS[hue], mode, nt.card);
      return [
        [`${hue}-bg`, bg],
        [`${hue}-fg`, fg],
      ];
    }),
  );
  const aliases = Object.fromEntries(
    Object.entries(COLOR_ALIASES).map(([alias, target]) => [alias, canonical[target]]),
  );
  return { ...canonical, ...hues, ...aliases } as ColorSet;
}

export interface ResolvedTheme {
  id: PresetId | 'custom';
  name: string;
  mode: ThemeMode;
  colors: ColorSet;
  elevation: ElevationSet;
  fontUi: string;
  fontCode: string;
}

export function resolvePreset(preset: PresetSource): ResolvedTheme {
  return {
    id: preset.id as PresetId,
    name: preset.name,
    mode: preset.mode,
    colors: resolveColors({
      mode: preset.mode,
      accent: preset.accent,
      neutrals: preset.neutrals,
      ...(preset.exact ? { exact: preset.exact } : {}),
    }),
    elevation: ELEVATIONS[preset.mode],
    fontUi: FONTS[preset.font].stack,
    fontCode: MONO_STACK,
  };
}

export const THEMES: readonly ResolvedTheme[] = PRESETS.map(resolvePreset);

export function themeById(id: string): ResolvedTheme {
  return THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as ResolvedTheme);
}
