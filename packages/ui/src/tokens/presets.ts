/**
 * The eight presets. Classic and Dark carry the design review's values exactly (kit.css `.px`
 * and `.px.dark`, ADR 0015); the other six keep their accent and font and project their old
 * neutral scale onto the reduced set: page = sunken, panels = side, cards and canvas = the
 * surface, the two borders, and their text greys lifted until each passes 4.5:1 on every surface.
 */
import type { FontId } from './fonts.ts';
import type { Neutrals, ThemeMode } from './names.ts';

export interface PresetSource {
  id: string;
  name: string;
  mode: ThemeMode;
  /** [accent, pressed accent (600), light accent (500)] */
  accent: readonly [string, string, string];
  neutrals: Neutrals;
  font: FontId;
  /** Exact values the review states; everything else derives in resolve.ts. */
  exact?: Readonly<Partial<Record<'acc-50' | 'acc-100' | 'acc-fill', string>>>;
}

/** kit.css `.px`, with tx-3 lifted from #6b7383 (4.4:1 on sunken) to pass 4.5:1. */
export const CLASSIC_NEUTRALS: Neutrals = {
  canvas: '#ffffff',
  side: '#f7f8fa',
  sunken: '#f5f6f8',
  card: '#ffffff',
  line: '#e7e9ee',
  'line-2': '#f0f1f4',
  tx: '#161b26',
  'tx-2': '#4b5264',
  'tx-3': '#697181',
};

/** kit.css `.px.dark`, with tx-3 lifted from #6f7786 (3.8:1 on cards) to pass 4.5:1. */
export const DARK_NEUTRALS: Neutrals = {
  canvas: '#111418',
  side: '#0c0f13',
  sunken: '#0e1115',
  card: '#181c22',
  line: 'rgba(255,255,255,.08)',
  'line-2': 'rgba(255,255,255,.05)',
  tx: '#e8ebf1',
  'tx-2': '#a8b0be',
  'tx-3': '#7d8492',
};

type N = [string, string, string, string, string, string, string, string, string];
const n = ([canvas, side, sunken, card, line, line2, tx, tx2, tx3]: N): Neutrals => ({
  canvas,
  side,
  sunken,
  card,
  line,
  'line-2': line2,
  tx,
  'tx-2': tx2,
  'tx-3': tx3,
});

const W8 = 'rgba(255,255,255,.08)';
const W5 = 'rgba(255,255,255,.05)';

export const PRESETS = [
  {
    id: 'light',
    name: 'Classic',
    mode: 'light',
    font: 'plex',
    // The logo's blue (brand-1) is the accent; its mid blue (brand-2) the light accent.
    accent: ['#2356c9', '#1d48ad', '#5b7be5'],
    neutrals: CLASSIC_NEUTRALS,
    exact: { 'acc-50': '#eef2fd', 'acc-100': '#dfe7fb' },
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    font: 'plex',
    // The logo's mid blue (brand-2) is the dark accent, lifted a hair to 4.5:1 on cards for
    // text; behind white text it is darkened to 4.5:1 instead.
    accent: ['#5e7ee6', '#4a68d0', '#7b95ec'],
    neutrals: DARK_NEUTRALS,
    exact: {
      'acc-50': 'rgba(91,123,229,.14)',
      'acc-100': 'rgba(91,123,229,.24)',
      'acc-fill': '#506ecf',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    mode: 'light',
    font: 'inter',
    accent: ['#0f766e', '#115e59', '#5eb8b0'],
    neutrals: n([
      '#ffffff',
      '#f5f7f9',
      '#eef1f4',
      '#ffffff',
      '#d9dfe6',
      '#e3e8ed',
      '#0f1a24',
      '#42505f',
      '#5f6d7c',
    ]),
  },
  {
    id: 'warm',
    name: 'Warm',
    mode: 'light',
    font: 'source',
    accent: ['#b4530f', '#8f3f08', '#d98b52'],
    neutrals: n([
      '#fffdf9',
      '#faf8f4',
      '#f6f3ee',
      '#fffdf9',
      '#e6e0d6',
      '#ece7de',
      '#241f19',
      '#564c41',
      '#726657',
    ]),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    font: 'geist',
    accent: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
    neutrals: n([
      '#110f1d',
      '#06050c',
      '#0b0a14',
      '#171428',
      W8,
      W5,
      '#ecebf5',
      '#aeaac6',
      '#8d88a8',
    ]),
  },
  {
    id: 'forest',
    name: 'Forest',
    mode: 'light',
    font: 'plex',
    accent: ['#1f7a44', '#155a32', '#5fb582'],
    neutrals: n([
      '#ffffff',
      '#f6f8f6',
      '#f1f4f1',
      '#ffffff',
      '#dbe2dc',
      '#e4eae5',
      '#14201a',
      '#415249',
      '#5f6f66',
    ]),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    mode: 'dark',
    font: 'inter',
    accent: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
    neutrals: n([
      '#0b1726',
      '#040912',
      '#07111c',
      '#101e30',
      W8,
      W5,
      '#e6f0fa',
      '#a3b7cd',
      '#8197b0',
    ]),
  },
  {
    id: 'rose',
    name: 'Rose',
    mode: 'light',
    font: 'source',
    accent: ['#be123c', '#9f1239', '#e05a7a'],
    neutrals: n([
      '#ffffff',
      '#faf7f8',
      '#f7f3f4',
      '#ffffff',
      '#e8dfe2',
      '#eee6e8',
      '#231a1d',
      '#564549',
      '#72606a',
    ]),
  },
] as const satisfies readonly PresetSource[];

export type PresetId = (typeof PRESETS)[number]['id'];

export const PRESET_IDS = PRESETS.map((preset) => preset.id) as readonly PresetId[];

export const DEFAULT_PRESET: PresetId = 'light';
