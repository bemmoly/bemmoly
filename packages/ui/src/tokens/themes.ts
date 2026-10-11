/**
 * The five themes (ADR 0021). Each is a pair: a designed light set and a designed dark set of
 * the fifteen theme tokens. Values are the approved theme review's, unchanged; every set passes
 * the fourteen checks in theme/checks.ts, and tokens.test.ts holds them to it.
 */
import type { FontId } from './fonts.ts';
import type { ThemeMode, ThemeSet } from './names.ts';

export interface ThemeSource {
  id: string;
  name: string;
  /** One word for the picker: what the theme is for. */
  tag: string;
  /** The high-contrast theme is held to 7:1 text and 3:1 control borders. */
  highContrast?: boolean;
  light: ThemeSet;
  dark: ThemeSet;
}

type Row = [
  canvas: string,
  side: string,
  sunken: string,
  card: string,
  line: string,
  line2: string,
  tx: string,
  tx2: string,
  tx3: string,
  acc: string,
  acc500: string,
  acc50: string,
  acc100: string,
  fill: string,
  on: string,
];

const set = ([canvas, side, sunken, card, line, line2, tx, tx2, tx3, ...a]: Row): ThemeSet => ({
  canvas,
  side,
  sunken,
  card,
  line,
  'line-2': line2,
  tx,
  'tx-2': tx2,
  'tx-3': tx3,
  acc: a[0],
  'acc-500': a[1],
  'acc-50': a[2],
  'acc-100': a[3],
  'acc-fill': a[4],
  'on-acc': a[5],
});

export const THEME_SOURCES = [
  {
    id: 'bemmoly',
    name: 'Bemmoly',
    tag: 'Default',
    // The logo's blue: brand-1 in light; brand-2 lifted for text and deepened for fills in dark.
    light: set([
      '#ffffff',
      '#f7f8fa',
      '#f5f6f8',
      '#ffffff',
      '#e3e6ec',
      '#eef0f3',
      '#161b26',
      '#4b5264',
      '#697181',
      '#2356c9',
      '#5b7be5',
      '#eef2fd',
      '#dfe7fb',
      '#2356c9',
      '#ffffff',
    ]),
    dark: set([
      '#111418',
      '#0c0f13',
      '#0e1115',
      '#181c22',
      '#2a2f38',
      '#20242b',
      '#e8ebf1',
      '#a8b0be',
      '#858c9a',
      '#7b95ec',
      '#9aaef1',
      '#1f273a',
      '#2a3654',
      '#4a68d0',
      '#ffffff',
    ]),
  },
  {
    id: 'graphite',
    name: 'Graphite',
    tag: 'Neutral',
    // True greys and ink buttons; links keep the logo blue.
    light: set([
      '#ffffff',
      '#f6f6f7',
      '#f3f3f5',
      '#ffffff',
      '#e2e2e6',
      '#ededf0',
      '#18181b',
      '#4a4a52',
      '#6b6b74',
      '#2356c9',
      '#5b7be5',
      '#f0f0f2',
      '#e2e2e6',
      '#27272a',
      '#ffffff',
    ]),
    dark: set([
      '#141416',
      '#0f0f11',
      '#111113',
      '#1b1b1e',
      '#2e2e33',
      '#242428',
      '#ececef',
      '#a9a9b2',
      '#88888f',
      '#8fa6f2',
      '#aebef5',
      '#26262b',
      '#323238',
      '#e4e4e7',
      '#18181b',
    ]),
  },
  {
    id: 'sand',
    name: 'Sand',
    tag: 'Warm',
    // The warmth is in the neutrals, never an orange that reads as Incident or a warning.
    light: set([
      '#fffdf9',
      '#f8f5ef',
      '#f5f1ea',
      '#fffdf9',
      '#e7e0d4',
      '#efe9df',
      '#231e17',
      '#554b3f',
      '#6f6455',
      '#2356c9',
      '#5b7be5',
      '#eff1f8',
      '#dfe4f3',
      '#2356c9',
      '#ffffff',
    ]),
    dark: set([
      '#17140f',
      '#110f0b',
      '#14110d',
      '#1e1a14',
      '#352f25',
      '#29241c',
      '#f0ebe2',
      '#b5ab9b',
      '#968b7a',
      '#7b95ec',
      '#9aaef1',
      '#232634',
      '#2e3449',
      '#4a68d0',
      '#ffffff',
    ]),
  },
  {
    id: 'pine',
    name: 'Pine',
    tag: 'Green',
    // Hue 170: darker and bluer than Done and Story green, so primary never reads as finished.
    light: set([
      '#ffffff',
      '#f5f8f7',
      '#f1f5f3',
      '#ffffff',
      '#dde5e1',
      '#e8eeeb',
      '#13201b',
      '#42524b',
      '#5f6f68',
      '#17675a',
      '#4f9d8c',
      '#ecf4f2',
      '#d6e8e3',
      '#17675a',
      '#ffffff',
    ]),
    dark: set([
      '#0f1513',
      '#0a0f0d',
      '#0c1210',
      '#151d1a',
      '#27322e',
      '#1d2623',
      '#e6efeb',
      '#a5b5ae',
      '#84948d',
      '#5fc0a8',
      '#86d2bf',
      '#18302a',
      '#21423a',
      '#1d7a69',
      '#ffffff',
    ]),
  },
  {
    id: 'contrast',
    name: 'High contrast',
    tag: 'Accessible',
    highContrast: true,
    light: set([
      '#ffffff',
      '#ffffff',
      '#f2f3f5',
      '#ffffff',
      '#8a909c',
      '#c3c8d0',
      '#000000',
      '#262b35',
      '#3f4551',
      '#1a44a6',
      '#2356c9',
      '#e3eafb',
      '#c6d4f6',
      '#1a44a6',
      '#ffffff',
    ]),
    dark: set([
      '#000000',
      '#000000',
      '#0b0c0e',
      '#0d0f12',
      '#7c8390',
      '#3a3f48',
      '#ffffff',
      '#d5d9e0',
      '#b4bac4',
      '#a3b6f6',
      '#c2cff9',
      '#18213a',
      '#25335a',
      '#a3b6f6',
      '#000000',
    ]),
  },
] as const satisfies readonly ThemeSource[];

export type ThemeId = (typeof THEME_SOURCES)[number]['id'];

export const THEME_IDS = THEME_SOURCES.map((theme) => theme.id) as readonly ThemeId[];

export const DEFAULT_THEME: ThemeId = 'bemmoly';

export function isThemeId(value: unknown): value is ThemeId {
  return (THEME_IDS as readonly unknown[]).includes(value);
}

export function themeSource(id: string): ThemeSource {
  return THEME_SOURCES.find((theme) => theme.id === id) ?? THEME_SOURCES[0];
}

/**
 * The eight retired presets, each mapped to a theme in its old mode with the typeface it
 * implied. Stored settings, saved device choices and old demo links all go through this.
 */
export const RETIRED_PRESETS: Readonly<
  Record<string, { theme: ThemeId; mode: ThemeMode; font: FontId }>
> = {
  classic: { theme: 'bemmoly', mode: 'light', font: 'plex' },
  light: { theme: 'bemmoly', mode: 'light', font: 'plex' },
  dark: { theme: 'bemmoly', mode: 'dark', font: 'plex' },
  slate: { theme: 'graphite', mode: 'light', font: 'inter' },
  warm: { theme: 'sand', mode: 'light', font: 'source' },
  midnight: { theme: 'bemmoly', mode: 'dark', font: 'geist' },
  forest: { theme: 'pine', mode: 'light', font: 'plex' },
  ocean: { theme: 'bemmoly', mode: 'dark', font: 'inter' },
  rose: { theme: 'bemmoly', mode: 'light', font: 'source' },
};
