/**
 * PLACEHOLDER for @bemmoly/ui/theme (buildTheme, contrast). Turns a brand
 * colour, mode, surface tone and typeface into the full token set, using the
 * Classic and Dark neutrals and the accent-tint derivation from tokens.ts.
 */
import type { CustomTheme } from '@bemmoly/shared';
import {
  accentTints,
  FONTS,
  MONO_STACK,
  ON_ACCENT,
  PRESETS,
  type ColorToken,
} from '@bemmoly/ui/tokens';

export interface BuiltTheme {
  mode: 'light' | 'dark';
  colors: Record<ColorToken, string>;
  fontUi: string;
  fontCode: string;
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  if (value.length !== 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = parseInt(value.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** WCAG contrast ratio between two six-digit hex colours. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The Appearance mock's contrast note for white text on the brand colour. */
export function contrastMessage(brand: string): string {
  const ratio = contrast(ON_ACCENT === '#fff' ? '#ffffff' : ON_ACCENT, brand);
  const shown = ratio.toFixed(1);
  if (ratio >= 4.5) return `White text on ${brand} is ${shown}:1. Passes for buttons and labels.`;
  if (ratio >= 3) {
    return `White text on ${brand} is ${shown}:1. We'll darken it for button text so it stays readable.`;
  }
  return `${brand} is too light for white text (${shown}:1). We'll use dark text on buttons and a darker shade for links.`;
}

const mix = (color: string, percent: number, base: string) =>
  `color-mix(in oklab, ${color} ${percent}%, ${base})`;

export function buildTheme(custom: CustomTheme): BuiltTheme {
  const base = PRESETS.find((preset) => preset.id === (custom.mode === 'dark' ? 'dark' : 'light'));
  const neutrals = { ...(base?.neutrals ?? PRESETS[0].neutrals) } as Record<string, string>;
  if (custom.surfaces === 'tinted') {
    const strength = custom.mode === 'dark' ? 8 : 4;
    for (const token of ['bg', 'bg2', 'br', 'br2', 'br3', 'trk', 'chip']) {
      neutrals[token] = mix(custom.brandColor, strength, neutrals[token] as string);
    }
  }
  const surface = neutrals['sf'] as string;
  const darkBase = PRESETS[1].neutrals.bg;
  const ratio = contrast('#ffffff', custom.brandColor);
  const accent =
    ratio >= 3 && ratio < 4.5 ? mix(custom.brandColor, 82, darkBase) : custom.brandColor;
  const onAccent = ratio < 3 ? (neutrals['tx'] as string) : ON_ACCENT;
  const colors = {
    ac: accent,
    'ac-d': mix(custom.brandColor, 72, darkBase),
    'ac-l': mix(
      custom.brandColor,
      60,
      custom.mode === 'dark' ? (neutrals['tx'] as string) : '#ffffff',
    ),
    ...accentTints(custom.brandColor, custom.mode, surface),
    'on-ac': onAccent,
    ...neutrals,
  } as Record<ColorToken, string>;
  return { mode: custom.mode, colors, fontUi: FONTS[custom.font].stack, fontCode: MONO_STACK };
}

/** CSS custom properties for a built theme, for <html> or a preview container. */
export function themeVariables(theme: BuiltTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [token, value] of Object.entries(theme.colors)) vars[`--${token}`] = value;
  vars['--font-ui'] = theme.fontUi;
  vars['--font-code'] = theme.fontCode;
  vars['color-scheme'] = theme.mode;
  return vars;
}
