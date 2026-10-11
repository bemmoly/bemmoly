import { themeStyle } from '@bemmoly/ui/theme';
import { isThemeId, resolveSource, type ThemeMode, type ThemeSource } from '@bemmoly/ui/tokens';
import type { CSSProperties } from 'react';

/** What a themed miniature or preview carries: a built-in theme's attributes, or inline tokens. */
export interface ThemeScope {
  'data-theme'?: string;
  'data-mode'?: ThemeMode;
  style?: CSSProperties;
}

/** React wants camelCase for ordinary properties; custom properties keep their names. */
export function reactStyle(style: Record<string, string>): CSSProperties {
  return Object.fromEntries(
    Object.entries(style).map(([name, value]) => [
      name.startsWith('--')
        ? name
        : name.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  ) as CSSProperties;
}

/** Paints an element with one theme in one mode, whatever the page around it shows. */
export function themeScope(source: ThemeSource, mode: ThemeMode): ThemeScope {
  if (isThemeId(source.id)) return { 'data-theme': source.id, 'data-mode': mode };
  return { style: reactStyle(themeStyle(resolveSource(source, mode))) };
}
