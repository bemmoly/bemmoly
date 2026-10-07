/**
 * Status, priority, type and avatar colours. The mocks state them as light-mode literals
 * (Board, Backlog, Home, People, Issue). For dark themes they are derived with the one dark
 * rule the Board mock defines for coloured pairs: background = fg 30% over the surface,
 * foreground = fg 60% over white (its `people` remap), both in OKLab.
 */
import { mixCss } from '../theme/color.ts';
import type { Hue, ThemeMode } from './names.ts';

export const SIGNAL_SOLIDS = {
  ok: '#2b9b5a',
  danger: '#d93838',
  'danger-hi': '#c42d2d',
  warn: '#e0632a',
  caution: '#d49a1a',
  violet: '#8b5cf6',
  'on-solid': '#fff',
} as const;

export const SCRIM = 'rgba(16,24,40,.45)';

/** [background, foreground] pairs as the light mocks state them. */
export const PAIRS = {
  ok: ['#e3f4ea', '#1f7a44'],
  warn: ['#fdeee3', '#b4470f'],
  rev: ['#efe9fd', '#5a3cae'],
  qa: ['#fdf3dc', '#8a6210'],
} as const;

export const HUE_PAIRS: Readonly<Record<Hue, readonly [string, string]>> = {
  green: ['#d7f0e0', '#1f7a44'],
  orange: ['#fde2cf', '#9a4a16'],
  violet: ['#e4dcfa', '#5a3cae'],
  pink: ['#fbe3ee', '#a0245f'],
  amber: ['#fdf3dc', '#8a6210'],
  sky: ['#e0f2fe', '#075985'],
};

/** A coloured [bg, fg] pair for the mode; `surface` is the theme's card surface. */
export function pair(
  [bg, fg]: readonly [string, string],
  mode: ThemeMode,
  surface: string,
): [string, string] {
  if (mode === 'light') return [bg, fg];
  return [mixCss(fg, 30, surface), mixCss(fg, 60, '#fff')];
}
