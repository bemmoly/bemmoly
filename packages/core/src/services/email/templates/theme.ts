import { MONO_STACK, themeById } from '@bemmoly/ui/tokens';

/** What a workspace's emails are themed from: Settings › Appearance and the workspace name. */
export interface EmailBrand {
  workspaceName: string;
  /** Brand colour as #rrggbb: the custom colour, or the chosen preset's accent. */
  accent: string;
  /** Absolute URL of the logo image; without one the header shows an initial tile. */
  logoUrl: string | null;
  fontStack: string;
}

export interface EmailTheme {
  accent: string;
  /** Button fill: the accent, darkened when white text on it would be hard to read. */
  button: string;
  onButton: string;
  /** Link colour; readable on white. */
  link: string;
  tint: string;
  tintBorder: string;
  page: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  font: string;
  mono: string;
}

const HEX = /^#[0-9a-f]{6}$/i;

function channels(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Mixes `hex` into `base` by `weight` (0..1) in sRGB; email clients have no color-mix(). */
export function mixHex(hex: string, base: string, weight: number): string {
  const [r1, g1, b1] = channels(hex);
  const [r2, g2, b2] = channels(base);
  const mix = (a: number, b: number) => Math.round(a * weight + b * (1 - weight));
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((part) => {
    const c = part / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast of white text on `hex`, as the Appearance mock reports it. */
export function whiteContrast(hex: string): number {
  return 1.05 / (luminance(hex) + 0.05);
}

/**
 * Emails are always light: most clients ignore dark-mode styles or invert them
 * badly. Neutrals come from the Classic preset; the accent from the workspace.
 */
export function emailTheme(brand: EmailBrand): EmailTheme {
  const classic = themeById('light').colors;
  const accent = HEX.test(brand.accent) ? brand.accent.toLowerCase() : classic.ac;
  const contrast = whiteContrast(accent);
  const darker = mixHex(accent, '#000000', 0.75);
  const button = contrast >= 3 ? (contrast >= 4.5 ? accent : darker) : accent;
  return {
    accent,
    button,
    onButton: contrast >= 3 ? '#ffffff' : classic.tx,
    link: contrast >= 4.5 ? accent : darker,
    tint: mixHex(accent, '#ffffff', 0.08),
    tintBorder: mixHex(accent, '#ffffff', 0.25),
    page: classic.bg,
    surface: classic.sf,
    border: classic.br,
    text: classic.tx,
    textMuted: classic.tx3,
    textSubtle: classic.tx5,
    font: brand.fontStack,
    mono: MONO_STACK,
  };
}

export const DEFAULT_BRAND: EmailBrand = {
  workspaceName: 'Bemmoly',
  accent: themeById('light').colors.ac,
  logoUrl: null,
  fontStack: themeById('light').fontUi,
};
