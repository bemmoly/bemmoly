import type { CustomThemeRecord } from '@bemmoly/shared';
import { customThemeSource } from '@bemmoly/ui/theme';
import { THEME_SOURCES, type ThemeSource } from '@bemmoly/ui/tokens';
import { customRef, type ThemeRef } from '../lib/theme.ts';

/** One theme a picker offers: its reference, its two designed sets and a word for the tile. */
export interface ThemeOption {
  ref: ThemeRef;
  source: ThemeSource;
  note: string;
  /** Custom themes can be edited from the picker. */
  custom?: CustomThemeRecord;
}

/** The five built-in themes, then the custom ones, in the order the server lists them. */
export function themeOptions(customThemes: readonly CustomThemeRecord[]): ThemeOption[] {
  return [
    ...THEME_SOURCES.map((source) => ({ ref: source.id, source, note: source.tag })),
    ...customThemes.map((theme) => ({
      ref: customRef(theme.id),
      source: customThemeSource(theme.id, theme.name, {
        brand: theme.brandColor,
        surface: theme.surface,
      }),
      note: theme.scope === 'personal' ? 'Yours' : 'Custom',
      custom: theme,
    })),
  ];
}
