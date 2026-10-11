/**
 * The colour families that do not follow the preset's accent (ADR 0015). Values come from
 * docs/design/premium/kit.css; where a kit value fails the 4.5:1 text or 3:1 graphic contrast
 * the product promises, it is lifted the smallest step that passes, and the comment says so.
 */
import { mixCss } from '../theme/color.ts';
import type { ElevationSet, Hue, ThemeMode } from './names.ts';

/** The logo's three colours. Fixed: no preset or custom theme changes them, nor the mark. */
export const BRAND = {
  'brand-1': '#2356c9',
  'brand-2': '#5b7be5',
  'brand-3': '#9a85ea',
} as const;

/** Issue type tiles. Fixed across presets and modes so a type never shares a status colour. */
export const TYPE_COLORS = {
  'type-epic': '#6e56cf',
  'type-story': '#1f9d55',
  'type-task': '#2356c9',
  'type-bug': '#e5484d',
  'type-subtask': '#0e9bb0',
  // The kit draws no incident; the orange of its palette, clear of bug red and story green.
  'type-incident': '#d46a2e',
} as const;

export type TypeColorToken = keyof typeof TYPE_COLORS;

/**
 * Eight epic hues: the colour is stored on the epic and is the same on every screen. The danger
 * red is left out so an epic never reads as an error.
 */
export const EPIC_COLORS = {
  'epic-1': '#2356c9',
  'epic-2': '#6e56cf',
  'epic-3': '#0e9bb0',
  'epic-4': '#d46a2e',
  'epic-5': '#2f9e6e',
  'epic-6': '#c2536a',
  'epic-7': '#b7791f',
  'epic-8': '#9b4f96',
} as const;

/**
 * Solid avatar colours, white initials on top, one per avatar hue (the signed-in person wears
 * the accent). The kit's people colours, each darkened the least that carries white initials
 * at 4.5:1.
 */
export const AVATAR_COLORS = {
  'avatar-green': '#26855c',
  'avatar-orange': '#b85b27',
  'avatar-violet': '#875fca',
  'avatar-pink': '#bd5167',
  'avatar-amber': '#a36c1b',
  'avatar-sky': '#247cae',
} as const;

export type AvatarColor = keyof typeof AVATAR_COLORS extends `avatar-${infer C}` ? C : never;

/** Every fixed colour, emitted once on :root. */
export const FIXED_COLORS = {
  ...BRAND,
  ...TYPE_COLORS,
  ...EPIC_COLORS,
  ...AVATAR_COLORS,
} as const;

export type FixedColorToken = keyof typeof FIXED_COLORS;
export const FIXED_COLOR_TOKENS = Object.keys(FIXED_COLORS) as FixedColorToken[];

export const SCRIM = 'rgba(16,24,40,.45)';

const translucent = (hex: string, alpha: number) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Hover and press overlays: the ink at 4.5% and 7% in light themes, white in dark ones. */
export function overlays(mode: ThemeMode, ink: string) {
  if (mode === 'dark') return { hover: 'rgba(255,255,255,.05)', press: 'rgba(255,255,255,.08)' };
  return { hover: translucent(ink, 0.045), press: translucent(ink, 0.07) };
}

/** Lines in dark themes are white hairlines, so they sit right on any dark surface. */
export const DARK_LINES = { line: 'rgba(255,255,255,.08)', 'line-2': 'rgba(255,255,255,.05)' };

/** Status categories, signal colours and AI, per mode. */
export const MODE_COLORS = {
  light: {
    // kit #9aa1ae is 2.6:1 on white; lifted to the 3:1 a status glyph needs.
    todo: '#888f9c',
    prog: '#2356c9',
    done: '#1f9d55',
    red: '#e5484d',
    'red-tx': '#c43c41',
    'red-50': '#fdeeee',
    amber: '#d97706',
    'amber-tx': '#ac5d04',
    'amber-50': '#fff6e6',
    green: '#1f9d55',
    'green-tx': '#177e43',
    'green-50': '#e8f5ee',
    ai: '#9a85ea',
    // kit #7b63da is 4.1:1 on ai-50; darkened to 4.5:1 for AI text on its own background.
    'ai-600': '#725dca',
    'ai-100': '#e3dcfa',
    'ai-50': '#f4f1fd',
  },
  dark: {
    todo: '#6f7786',
    prog: '#6f8ff0',
    done: '#3fb67a',
    red: '#e5484d',
    'red-tx': '#ec6266',
    'red-50': 'rgba(229,72,77,.14)',
    amber: '#d97706',
    'amber-tx': '#e8901f',
    'amber-50': 'rgba(217,119,6,.14)',
    green: '#3fb67a',
    'green-tx': '#4cc487',
    'green-50': 'rgba(63,182,122,.14)',
    ai: '#9a85ea',
    'ai-600': '#ab99ef',
    'ai-100': 'rgba(154,133,234,.28)',
    'ai-50': 'rgba(154,133,234,.14)',
  },
} as const;

/** kit.css --e1 … --e3, and the first release's shadow names on the nearest elevation. */
export const ELEVATIONS: Readonly<Record<ThemeMode, ElevationSet>> = {
  light: elevationSet({
    e1: '0 1px 2px rgba(16,24,40,.05),0 0 0 1px rgba(16,24,40,.06)',
    e1h: '0 4px 12px rgba(16,24,40,.08),0 0 0 1px rgba(16,24,40,.08)',
    e2: '0 12px 32px rgba(16,24,40,.14),0 0 0 1px rgba(16,24,40,.08)',
    e3: '0 24px 64px rgba(16,24,40,.22),0 0 0 1px rgba(16,24,40,.08)',
  }),
  dark: elevationSet({
    e1: '0 0 0 1px rgba(255,255,255,.07)',
    e1h: '0 0 0 1px rgba(255,255,255,.14),0 6px 16px rgba(0,0,0,.4)',
    e2: '0 0 0 1px rgba(255,255,255,.1),0 16px 40px rgba(0,0,0,.55)',
    e3: '0 0 0 1px rgba(255,255,255,.1),0 24px 64px rgba(0,0,0,.6)',
  }),
};

function elevationSet(e: ElevationSet): ElevationSet {
  return e;
}

/** [background, foreground] legacy pastel pairs, light mode. */
export const HUE_PAIRS: Readonly<Record<Hue, readonly [string, string]>> = {
  green: ['#d7f0e0', '#1f7a44'],
  orange: ['#fde2cf', '#9a4a16'],
  violet: ['#e4dcfa', '#5a3cae'],
  pink: ['#fbe3ee', '#a0245f'],
  amber: ['#fdf3dc', '#8a6210'],
  sky: ['#e0f2fe', '#075985'],
};

/** A legacy pair for the mode; dark mixes the fg 30% over the card and 60% over white. */
export function pair(
  [bg, fg]: readonly [string, string],
  mode: ThemeMode,
  surface: string,
): [string, string] {
  if (mode === 'light') return [bg, fg];
  return [mixCss(fg, 30, surface), mixCss(fg, 60, '#fff')];
}
