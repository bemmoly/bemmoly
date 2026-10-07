/**
 * The custom theme builder from the Appearance Settings mock: brand colour, light or dark,
 * neutral grey or brand-tinted surfaces, typeface. The derivations are the `custom` branch
 * of the Board mock's theme table; the contrast handling implements the promise each of the
 * mock's three contrast messages makes.
 */
import { CLASSIC_NEUTRALS, DARK_NEUTRALS, PRESETS } from '../tokens/presets.ts';
import { FONTS, MONO_STACK, type FontId } from '../tokens/fonts.ts';
import type { NeutralScale, ThemeMode } from '../tokens/names.ts';
import { resolveColors, type ResolvedTheme } from '../tokens/resolve.ts';
import { isHex, mixCss } from './color.ts';
import { contrastCheck, darkenForWhiteText, type ContrastResult } from './contrast.ts';

export type SurfaceTone = 'neutral' | 'tinted';

export interface ThemeInput {
  /** Six-digit hex, as the Appearance mock's hex field accepts. */
  brand: string;
  mode: ThemeMode;
  surfaces: SurfaceTone;
  font: FontId;
}

export interface BuiltTheme extends ResolvedTheme {
  id: 'custom';
  input: ThemeInput;
  contrast: ContrastResult;
}

/** Text on a fill too light for white: Classic's primary text colour. */
const DARK_ON_ACCENT = CLASSIC_NEUTRALS.tx;

const LIGHT_BASE = CLASSIC_NEUTRALS.bg;
const DARK_BASE = DARK_NEUTRALS.bg;

function neutralsFor({ brand, mode, surfaces }: ThemeInput): NeutralScale {
  const tinted = surfaces === 'tinted';
  if (mode === 'dark') {
    const tint = (p: number) => mixCss(brand, p, DARK_BASE);
    if (!tinted) return DARK_NEUTRALS;
    return { ...DARK_NEUTRALS, bg: tint(6), bg2: tint(8), sf: tint(10) };
  }
  if (!tinted) return CLASSIC_NEUTRALS;
  const tint = (p: number) => mixCss(brand, p, LIGHT_BASE);
  return { ...CLASSIC_NEUTRALS, bg: tint(5), bg2: tint(3) };
}

/** Classic's literal neutral extras, reused where the builder's neutrals are Classic's. */
const CLASSIC_VALUES = PRESETS[0].exact.values;
const NEUTRAL_EXTRAS = ['sf2', 'br-row', 'br-ctl', 'br-off', 'tx-body'] as const;

export function buildTheme(input: ThemeInput): BuiltTheme {
  if (!isHex(input.brand)) {
    throw new Error(`Brand colour must be six hex digits, like #f97316 (got "${input.brand}").`);
  }
  const brand = input.brand.toLowerCase();
  const normalised = { ...input, brand };
  const contrast = contrastCheck(input.brand);
  const light = input.mode === 'light';

  let fill: string | undefined;
  let text: string | undefined;
  let onAccent: string | undefined;
  if (contrast.level === 'darken') fill = darkenForWhiteText(brand);
  if (contrast.level === 'dark-text') {
    onAccent = DARK_ON_ACCENT;
    if (light) text = darkenForWhiteText(brand);
  }

  const classicNeutrals = light && input.surfaces === 'neutral';
  const values = classicNeutrals
    ? Object.fromEntries(NEUTRAL_EXTRAS.map((token) => [token, CLASSIC_VALUES[token]]))
    : undefined;

  const colors = resolveColors({
    mode: input.mode,
    accent: [brand, mixCss(brand, 75, '#000'), mixCss(brand, 55, '#fff')],
    ...(fill ? { fill } : {}),
    neutrals: neutralsFor(normalised),
    ...(values ? { exact: { values } } : {}),
    ...(text ? { text } : {}),
    ...(onAccent ? { onAccent } : {}),
  });

  return {
    id: 'custom',
    name: 'Custom',
    mode: input.mode,
    colors,
    fontUi: FONTS[input.font].stack,
    fontCode: MONO_STACK,
    input: normalised,
    contrast,
  };
}
