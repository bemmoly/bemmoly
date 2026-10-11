/**
 * Turns a theme's fifteen tokens and a mode into the full colour set. Built-in themes and
 * custom themes go through the same function, so a token added here reaches all of them.
 */
import { mixCss } from '../theme/color.ts';
import {
  HUES,
  type CanonicalColorToken,
  type ColorSet,
  type ElevationSet,
  type ThemeMode,
  type ThemeSet,
} from './names.ts';
import { THEME_SOURCES, themeSource, type ThemeSource } from './themes.ts';
import { ELEVATIONS, HUE_PAIRS, MODE_COLORS, SCRIM, overlays, pair } from './semantic.ts';

export function resolveColors(set: ThemeSet, mode: ThemeMode): ColorSet {
  const canonical: Record<CanonicalColorToken, string> = {
    canvas: set.canvas,
    side: set.side,
    sunken: set.sunken,
    card: set.card,
    ...overlays(mode, set.tx),
    line: set.line,
    'line-2': set['line-2'],
    tx: set.tx,
    'tx-2': set['tx-2'],
    'tx-3': set['tx-3'],
    acc: set.acc,
    // The pressed fill: the fill a step darker, whatever its lightness.
    'acc-600': mixCss(set['acc-fill'], 85, '#000'),
    'acc-500': set['acc-500'],
    'acc-100': set['acc-100'],
    'acc-50': set['acc-50'],
    'acc-fill': set['acc-fill'],
    'on-acc': set['on-acc'],
    ...MODE_COLORS[mode],
    'on-solid': '#fff',
    scrim: SCRIM,
  };
  const hues = Object.fromEntries(
    HUES.flatMap((hue) => {
      const [bg, fg] = pair(HUE_PAIRS[hue], mode, set.card);
      return [
        [`${hue}-bg`, bg],
        [`${hue}-fg`, fg],
      ];
    }),
  );
  return { ...canonical, ...hues } as ColorSet;
}

export interface ResolvedTheme {
  /** A built-in theme id, or a custom theme's own id. */
  id: string;
  name: string;
  mode: ThemeMode;
  colors: ColorSet;
  elevation: ElevationSet;
}

export function resolveSource(source: ThemeSource, mode: ThemeMode): ResolvedTheme {
  return {
    id: source.id,
    name: source.name,
    mode,
    colors: resolveColors(source[mode], mode),
    elevation: ELEVATIONS[mode],
  };
}

/** A built-in theme in one mode; an unknown id is Bemmoly. */
export function resolveTheme(id: string, mode: ThemeMode): ResolvedTheme {
  return resolveSource(themeSource(id), mode);
}

/** Every built-in theme in both modes, light first. */
export const RESOLVED_THEMES: readonly ResolvedTheme[] = THEME_SOURCES.flatMap((source) => [
  resolveSource(source, 'light'),
  resolveSource(source, 'dark'),
]);
