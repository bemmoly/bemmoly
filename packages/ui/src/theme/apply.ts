import { COLOR_TOKENS, type ColorSet, type ThemeMode } from '../tokens/names.ts';
import { resolveHex } from './color.ts';

/** What applyTheme needs: a preset from THEMES or the result of buildTheme. */
export interface ThemeTokens {
  id: string;
  mode: ThemeMode;
  colors: ColorSet;
  fontUi: string;
  fontCode: string;
}

const PROPERTY_NAMES = [
  ...COLOR_TOKENS.map((token) => `--${token}`),
  '--font-ui',
  '--font-code',
  'color-scheme',
];

/** The theme as CSS custom properties, for a style attribute or a server-rendered root. */
export function themeStyle(theme: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const token of COLOR_TOKENS) style[`--${token}`] = theme.colors[token];
  style['--font-ui'] = theme.fontUi;
  style['--font-code'] = theme.fontCode;
  style['color-scheme'] = theme.mode;
  return style;
}

/**
 * Applies a theme to an element (usually document.documentElement) as inline custom
 * properties, which override the preset blocks in theme.css. `data-theme` is set so CSS and
 * tests can tell which theme is active.
 */
export function applyTheme(el: HTMLElement, theme: ThemeTokens): void {
  for (const [name, value] of Object.entries(themeStyle(theme))) el.style.setProperty(name, value);
  el.dataset['theme'] = theme.id;
}

/** Removes what applyTheme set, falling back to the `data-theme` preset in theme.css. */
export function clearTheme(el: HTMLElement, presetId?: string): void {
  for (const name of PROPERTY_NAMES) el.style.removeProperty(name);
  if (presetId) el.dataset['theme'] = presetId;
  else delete el.dataset['theme'];
}

/**
 * Every colour as plain hex (color-mix() evaluated), for places that cannot run CSS
 * color-mix, such as email clients. The scrim keeps its rgba() value.
 */
export function toHexColors(colors: ColorSet): Record<string, string> {
  return Object.fromEntries(
    Object.entries(colors).map(([token, value]) => [
      token,
      value.startsWith('rgba(') ? value : resolveHex(value),
    ]),
  );
}
