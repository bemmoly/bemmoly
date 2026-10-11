import {
  COLOR_TOKENS,
  ELEVATION_TOKENS,
  type ColorSet,
  type ElevationSet,
  type ThemeMode,
} from '../tokens/names.ts';
import { MODE_TYPE_COLORS } from '../tokens/semantic.ts';
import { resolveHex } from './color.ts';

/**
 * What applyTheme needs: a resolved theme in one mode. The typeface is not part of a theme
 * (ADR 0021); it is set apart with `data-font`.
 */
export interface ThemeTokens {
  id: string;
  mode: ThemeMode;
  colors: ColorSet;
  elevation: ElevationSet;
}

const TYPE_TOKENS = Object.keys(MODE_TYPE_COLORS.light);

const PROPERTY_NAMES = [
  ...COLOR_TOKENS.map((token) => `--${token}`),
  ...TYPE_TOKENS.map((token) => `--${token}`),
  ...ELEVATION_TOKENS.map((token) => `--${token}`),
  'color-scheme',
];

/** The theme as CSS custom properties, for a style attribute or a server-rendered root. */
export function themeStyle(theme: ThemeTokens): Record<string, string> {
  const style: Record<string, string> = {};
  for (const token of COLOR_TOKENS) style[`--${token}`] = theme.colors[token];
  for (const [token, value] of Object.entries(MODE_TYPE_COLORS[theme.mode]))
    style[`--${token}`] = value;
  for (const token of ELEVATION_TOKENS) style[`--${token}`] = theme.elevation[token];
  style['color-scheme'] = theme.mode;
  return style;
}

/**
 * Applies a theme to an element (usually document.documentElement) as inline custom
 * properties, which override the theme blocks in theme.css. Custom themes reach the page this
 * way; `data-theme` and `data-mode` are set so CSS and tests can tell what is active.
 */
export function applyTheme(el: HTMLElement, theme: ThemeTokens): void {
  for (const [name, value] of Object.entries(themeStyle(theme))) el.style.setProperty(name, value);
  el.dataset['theme'] = theme.id;
  el.dataset['mode'] = theme.mode;
}

/** Removes what applyTheme set, falling back to the theme blocks in theme.css. */
export function clearTheme(el: HTMLElement, themeId?: string): void {
  for (const name of PROPERTY_NAMES) el.style.removeProperty(name);
  if (themeId) el.dataset['theme'] = themeId;
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
