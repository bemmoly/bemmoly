/**
 * The custom theme generator (ADR 0021): one brand colour and a surface style in, a checked
 * light and dark set out. Surfaces always come from a built-in theme (brand-tinted surfaces
 * are gone: they muddied dark mode and halved the contrast budget); only the six accent tokens
 * follow the brand, each moved the least that passes its checks. The logo never takes it.
 */
import type { ThemeSet } from '../tokens/names.ts';
import { themeSource, type ThemeSource } from '../tokens/themes.ts';
import { isHex, mixHex } from './color.ts';
import { reservedHue, themeChecks, type ReservedHue, type ThemeCheck } from './checks.ts';
import { contrastRatio } from './contrast.ts';

/** Which built-in theme lends its surfaces, lines and text greys. */
export const SURFACE_STYLES = {
  neutral: { name: 'Neutral', from: 'bemmoly' },
  warm: { name: 'Warm', from: 'sand' },
} as const;

export type SurfaceStyle = keyof typeof SURFACE_STYLES;
export const SURFACE_STYLE_IDS = Object.keys(SURFACE_STYLES) as SurfaceStyle[];

export interface CustomThemeInput {
  /** Six hex digits. */
  brand: string;
  surface: SurfaceStyle;
}

export interface CustomTheme {
  brand: string;
  surface: SurfaceStyle;
  light: ThemeSet;
  dark: ThemeSet;
  checks: { light: ThemeCheck[]; dark: ThemeCheck[] };
  /** Every check passes in both modes; the generator guarantees it for any input. */
  pass: boolean;
  /** The brand was moved for links or buttons in at least one mode. */
  adjusted: boolean;
  /** The reserved band the brand sits in: a warning, never a block. */
  guard: ReservedHue | null;
}

const WHITE = '#ffffff';
const BLACK = '#000000';
const DARK_INK = '#0b0d10';

/** The first step from `color` toward `target`, 2% at a time in sRGB, that passes `ok`. */
function toward(color: string, target: string, ok: (c: string) => boolean): string {
  for (let keep = 100; keep >= 0; keep -= 2) {
    const step = mixHex(color, keep, target, 'srgb');
    if (ok(step)) return step;
  }
  return target;
}

/** A tint of the brand over the card, the strongest at or under `percent` the text still reads on. */
function tint(brand: string, percent: number, card: string, tx: string, min: number): string {
  for (let p = percent; p > 0; p -= 1) {
    const c = mixHex(brand, p, card, 'srgb');
    if (contrastRatio(tx, c) >= min) return c;
  }
  return card;
}

function lightSet(brand: string, base: ThemeSet): ThemeSet {
  const surfaces = [base.canvas, base.side, base.sunken, base.card];
  const passesText = (c: string) => surfaces.every((s) => contrastRatio(c, s) >= 4.5);
  const carriesWhite = (c: string) => contrastRatio(WHITE, c) >= 4.5;
  return {
    ...base,
    acc: toward(brand, BLACK, passesText),
    'acc-500': mixHex(brand, 60, WHITE, 'srgb'),
    'acc-50': tint(brand, 8, base.card, base.tx, 4.5),
    'acc-100': mixHex(brand, 16, base.card, 'srgb'),
    'acc-fill': toward(brand, BLACK, carriesWhite),
    'on-acc': WHITE,
  };
}

function darkSet(brand: string, base: ThemeSet): ThemeSet {
  const surfaces = [base.canvas, base.side, base.sunken, base.card];
  const passesText = (c: string) => surfaces.every((s) => contrastRatio(c, s) >= 4.5);
  const acc = toward(brand, WHITE, passesText);
  // A fill dark enough for white text, lifted toward white until it stands off the page.
  const deep = toward(brand, BLACK, (c) => contrastRatio(WHITE, c) >= 4.5);
  const lifted = toward(deep, WHITE, (c) => contrastRatio(c, base.canvas) >= 3);
  let fill = acc;
  let on = DARK_INK;
  if (contrastRatio(WHITE, lifted) >= 4.5) [fill, on] = [lifted, WHITE];
  else if (contrastRatio(deep, base.canvas) >= 3) [fill, on] = [deep, WHITE];
  return {
    ...base,
    acc,
    'acc-500': mixHex(acc, 70, WHITE, 'srgb'),
    'acc-50': tint(brand, 16, base.card, base.tx, 4.5),
    'acc-100': mixHex(brand, 26, base.card, 'srgb'),
    'acc-fill': fill,
    'on-acc': on,
  };
}

export function buildCustomTheme(input: CustomThemeInput): CustomTheme {
  if (!isHex(input.brand)) {
    throw new Error(`Brand colour must be six hex digits, like #0f766e (got "${input.brand}").`);
  }
  const brand = input.brand.trim().toLowerCase();
  const base = themeSource(SURFACE_STYLES[input.surface].from);
  const light = lightSet(brand, base.light);
  const dark = darkSet(brand, base.dark);
  const checks = { light: themeChecks(light, 'light'), dark: themeChecks(dark, 'dark') };
  return {
    brand,
    surface: input.surface,
    light,
    dark,
    checks,
    pass: [...checks.light, ...checks.dark].every((check) => check.pass),
    adjusted: light.acc !== brand || light['acc-fill'] !== brand || dark.acc !== brand,
    guard: reservedHue(brand),
  };
}

/** A saved custom theme as a theme source, so it resolves and applies like the five. */
export function customThemeSource(id: string, name: string, input: CustomThemeInput): ThemeSource {
  const built = buildCustomTheme(input);
  return { id, name, tag: 'Custom', light: built.light, dark: built.dark };
}
