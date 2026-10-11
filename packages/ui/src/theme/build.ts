/**
 * The custom theme builder from the Appearance Settings mock: brand colour, light or dark,
 * neutral grey or brand-tinted surfaces, typeface. The derivations are the `custom` branch
 * of the Board mock's theme table; the contrast handling implements the promise each of the
 * mock's three contrast messages makes.
 */
import { CLASSIC_NEUTRALS, DARK_NEUTRALS } from '../tokens/presets.ts';
import { FONTS, MONO_STACK, type FontId } from '../tokens/fonts.ts';
import type { Neutrals, ThemeMode } from '../tokens/names.ts';
import { DARK_ON_ACCENT, resolveColors, type ResolvedTheme } from '../tokens/resolve.ts';
import { ELEVATIONS } from '../tokens/semantic.ts';
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

/** Classic's or Dark's neutrals; tinted surfaces lean a few percent toward the brand. */
function neutralsFor({ brand, mode, surfaces }: ThemeInput): Neutrals {
  const base = mode === 'dark' ? DARK_NEUTRALS : CLASSIC_NEUTRALS;
  if (surfaces !== 'tinted') return base;
  if (mode === 'dark') {
    return {
      ...base,
      canvas: mixCss(brand, 8, base.canvas),
      side: mixCss(brand, 5, base.side),
      sunken: mixCss(brand, 6, base.sunken),
      card: mixCss(brand, 10, base.card),
    };
  }
  return { ...base, side: mixCss(brand, 3, base.side), sunken: mixCss(brand, 5, base.sunken) };
}

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

  const colors = resolveColors({
    mode: input.mode,
    accent: [brand, mixCss(brand, 75, '#000'), mixCss(brand, 55, '#fff')],
    ...(fill ? { fill } : {}),
    neutrals: neutralsFor(normalised),
    ...(text ? { text } : {}),
    ...(onAccent ? { onAccent } : {}),
  });

  return {
    id: 'custom',
    name: 'Custom',
    mode: input.mode,
    colors,
    elevation: ELEVATIONS[input.mode],
    fontUi: FONTS[input.font].stack,
    fontCode: MONO_STACK,
    input: normalised,
    contrast,
  };
}
