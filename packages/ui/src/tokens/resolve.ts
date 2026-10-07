/**
 * Turns a preset (or the custom builder's inputs) into the full colour set. Presets and
 * custom themes go through the same derivations, so a token added here reaches all of them.
 */
import { mixCss } from '../theme/color.ts';
import { FONTS, MONO_STACK } from './fonts.ts';
import {
  HUES,
  type AccentTints,
  type ColorSet,
  type ColorToken,
  type NeutralScale,
  type ThemeMode,
} from './names.ts';
import { PRESETS, type PresetId, type PresetSource } from './presets.ts';
import { HUE_PAIRS, PAIRS, SCRIM, SIGNAL_SOLIDS, pair } from './semantic.ts';

/** Text on an accent fill, as in the mock's primary button. */
export const ON_ACCENT = '#fff';

/** The Board mock's derivation of accent tints from the accent and the surface. */
export function accentTints(accent: string, mode: ThemeMode, surface: string): AccentTints {
  const dark = mode === 'dark';
  const base = dark ? surface : '#fff';
  return {
    'ac-bg': mixCss(accent, dark ? 18 : 9, base),
    'ac-bg2': mixCss(accent, dark ? 10 : 5, base),
    'ac-br': mixCss(accent, dark ? 35 : 22, base),
    'ac-av': mixCss(accent, dark ? 30 : 18, base),
    'ac-mute': mixCss(accent, 55, base),
  };
}

export interface ColorInputs {
  mode: ThemeMode;
  /** [accent, darker accent, lighter accent]; tints derive from the first. */
  accent: readonly [string, string, string];
  /** Fill behind on-accent text when it must differ from the accent (mid-contrast brands). */
  fill?: string;
  neutrals: NeutralScale;
  exact?: PresetSource['exact'];
  /** Accent used for text and lines when it must differ from the fill (light brands). */
  text?: string;
  /** Text on accent fills. */
  onAccent?: string;
}

export function resolveColors(input: ColorInputs): ColorSet {
  const { mode, neutrals: nt, exact } = input;
  const [brand, acD, acL] = input.accent;
  const ac = input.text ?? brand;
  const fill = input.fill ?? brand;
  const dark = mode === 'dark';
  const base = dark ? nt.sf : '#fff';
  const tints = exact?.tints ?? accentTints(brand, mode, nt.sf);
  const pick = (token: string, derived: string) => exact?.values?.[token] ?? derived;

  const acBr2 = pick('ac-br2', mixCss(brand, dark ? 28 : 17.5, base, 'srgb'));
  const extras = {
    sf2: pick('sf2', mixCss(nt.bg2, 80, nt.sf, 'srgb')),
    'br-row': pick('br-row', mixCss(nt.br2, 50, nt.chip, 'srgb')),
    'br-ctl': pick('br-ctl', mixCss(nt.tx6, 25, nt.br3, 'srgb')),
    'br-off': pick('br-off', mixCss(nt.tx6, 13, nt.br3, 'srgb')),
    'tx-body': pick('tx-body', mixCss(nt.tx, 50, nt.tx2, 'srgb')),
  };
  const [okBg, okFg] = pair(PAIRS.ok, mode, nt.sf);
  const [warnBg, warnFg] = pair(PAIRS.warn, mode, nt.sf);
  const [revBg, revFg] = pair(PAIRS.rev, mode, nt.sf);
  const [qaBg, qaFg] = pair(PAIRS.qa, mode, nt.sf);
  const hues = Object.fromEntries(
    HUES.flatMap((hue) => {
      const [bg, fg] = pair(HUE_PAIRS[hue], mode, nt.sf);
      return [
        [`${hue}-bg`, bg],
        [`${hue}-fg`, fg],
      ];
    }),
  );

  const colors: Record<ColorToken, string> = {
    ac,
    'ac-d': acD,
    'ac-l': acL,
    ...tints,
    'ac-br2': acBr2,
    'ac-fill': fill,
    'on-ac': input.onAccent ?? ON_ACCENT,
    ...nt,
    ...extras,
    ai: ac,
    'ai-mute': tints['ac-mute'],
    'ai-bg': tints['ac-bg2'],
    'ai-tint': tints['ac-bg'],
    'ai-br': tints['ac-br'],
    'ai-br2': acBr2,
    'ai-tx': extras['tx-body'],
    ...SIGNAL_SOLIDS,
    'ok-fg': okFg,
    'ok-bg': okBg,
    'warn-fg': warnFg,
    'warn-bg': warnBg,
    scrim: SCRIM,
    'st-todo-bg': nt.chip,
    'st-todo-fg': nt.tx3,
    'st-prog-bg': tints['ac-bg'],
    'st-prog-fg': ac,
    'st-rev-bg': revBg,
    'st-rev-fg': revFg,
    'st-qa-bg': qaBg,
    'st-qa-fg': qaFg,
    'st-done-bg': okBg,
    'st-done-fg': okFg,
    ...(hues as Record<`${(typeof HUES)[number]}-${'bg' | 'fg'}`, string>),
  };
  return colors;
}

export interface ResolvedTheme {
  id: PresetId | 'custom';
  name: string;
  mode: ThemeMode;
  colors: ColorSet;
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
    fontUi: FONTS[preset.font].stack,
    fontCode: MONO_STACK,
  };
}

export const THEMES: readonly ResolvedTheme[] = PRESETS.map(resolvePreset);

export function themeById(id: string): ResolvedTheme {
  return THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as ResolvedTheme);
}
