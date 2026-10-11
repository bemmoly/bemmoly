import { FONTS, MONO_STACK, themeSource, type ThemeSet } from '@bemmoly/ui/tokens';

/** What a workspace's emails are themed from: Settings › Appearance and the workspace name. */
export interface EmailBrand {
  workspaceName: string;
  /**
   * The workspace theme's light set: a built-in theme's, or a custom theme's as the generator
   * checked it, never a raw brand hex (ADR 0021).
   */
  colors: ThemeSet;
  /** Absolute URL of the logo image; without one the header shows an initial tile. */
  logoUrl: string | null;
  fontStack: string;
}

export interface EmailTheme {
  accent: string;
  /** Button fill and its label, both checked for contrast by the theme. */
  button: string;
  onButton: string;
  /** Link colour; readable on every light surface. */
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

/**
 * Emails are always light: most clients ignore dark-mode styles or invert them badly. Every
 * colour comes from the workspace theme's light set.
 */
export function emailTheme(brand: EmailBrand): EmailTheme {
  const c = brand.colors;
  return {
    accent: c.acc,
    button: c['acc-fill'],
    onButton: c['on-acc'],
    link: c.acc,
    tint: c['acc-50'],
    tintBorder: c['acc-100'],
    page: c.sunken,
    surface: c.card,
    border: c.line,
    text: c.tx,
    textMuted: c['tx-2'],
    textSubtle: c['tx-3'],
    font: brand.fontStack,
    mono: MONO_STACK,
  };
}

export const DEFAULT_BRAND: EmailBrand = {
  workspaceName: 'Bemmoly',
  colors: themeSource('bemmoly').light,
  logoUrl: null,
  fontStack: FONTS.plex.stack,
};
