/**
 * The eight presets, copied from the theme table in the Board mock's DCLogic block.
 * Classic additionally carries the exact values the mocks state as literals; every other
 * value is derived in resolve.ts with the Board mock's formulas.
 */
import type { FontId } from './fonts.ts';
import { NEUTRAL_TOKENS, type AccentTints, type NeutralScale, type ThemeMode } from './names.ts';

export interface PresetSource {
  id: string;
  name: string;
  mode: ThemeMode;
  /** [accent, darker accent, lighter accent] */
  accent: readonly [string, string, string];
  neutrals: NeutralScale;
  font: FontId;
  /** Exact values where a mock states them; otherwise derived by `resolveColors`. */
  exact?: { tints?: AccentTints; values?: Readonly<Partial<Record<string, string>>> };
}

const n = (values: string): NeutralScale => {
  const parts = values.split(' ');
  return Object.fromEntries(NEUTRAL_TOKENS.map((token, i) => [token, parts[i]])) as NeutralScale;
};

export const CLASSIC_NEUTRALS = n(
  '#f4f5f7 #f9fafb #fff #e2e5ea #e9ecf0 #d5dae2 #e5e8ee #eef0f4 #1b2430 #3b4454 #4b5565 #6b7483 #8a93a3 #a2aab8',
);

export const DARK_NEUTRALS = n(
  '#0f1217 #141821 #1a1f29 #262c38 #222834 #323a48 #2a3140 #262c38 #e9edf3 #c3c9d4 #aab2bf #8b94a3 #6c7585 #566070',
);

export const PRESETS = [
  {
    id: 'light',
    name: 'Classic',
    mode: 'light',
    font: 'plex',
    accent: ['#2456c9', '#183d94', '#6a8fe8'],
    neutrals: CLASSIC_NEUTRALS,
    exact: {
      tints: {
        'ac-bg': '#eef3fe',
        'ac-bg2': '#f6f8fe',
        'ac-br': '#cdd8f3',
        'ac-av': '#d7e3fb',
        'ac-mute': '#7a93d9',
      },
      // Literals used by the non-Board mocks (callout border, table header, row divider,
      // checkbox border, switch track, body copy).
      values: {
        'ac-br2': '#d9e1f5',
        sf2: '#fafbfc',
        'br-row': '#eceef2',
        'br-ctl': '#c8ced8',
        'br-off': '#cfd4dc',
        'tx-body': '#2c3545',
      },
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    font: 'plex',
    accent: ['#5b8def', '#3b6fd6', '#8db0f5'],
    neutrals: DARK_NEUTRALS,
  },
  {
    id: 'slate',
    name: 'Slate',
    mode: 'light',
    font: 'inter',
    accent: ['#0f766e', '#115e59', '#5eb8b0'],
    neutrals: n(
      '#eef1f4 #f5f7f9 #fff #d9dfe6 #e3e8ed #c8d0da #dde3ea #e6ebf0 #0f1a24 #2e3d4d #42505f #5f6d7c #7f8b99 #9aa5b1',
    ),
  },
  {
    id: 'warm',
    name: 'Warm',
    mode: 'light',
    font: 'source',
    accent: ['#b4530f', '#8f3f08', '#d98b52'],
    neutrals: n(
      '#f6f3ee #faf8f4 #fffdf9 #e6e0d6 #ece7de #d8d0c3 #e8e2d8 #efeae1 #241f19 #453c32 #564c41 #726657 #92877a #ada397',
    ),
  },
  {
    id: 'midnight',
    name: 'Midnight',
    mode: 'dark',
    font: 'geist',
    accent: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
    neutrals: n(
      '#0b0a14 #110f1d #171428 #2a2542 #241f3a #3a3356 #2a2542 #241f3a #ecebf5 #c8c5db #aeaac6 #8d88a8 #6e6989 #56516f',
    ),
  },
  {
    id: 'forest',
    name: 'Forest',
    mode: 'light',
    font: 'plex',
    accent: ['#1f7a44', '#155a32', '#5fb582'],
    neutrals: n(
      '#f1f4f1 #f6f8f6 #fff #dbe2dc #e4eae5 #c9d3cb #dfe6e0 #e7ede8 #14201a #2f3f36 #415249 #5f6f66 #808f86 #9ba8a0',
    ),
  },
  {
    id: 'ocean',
    name: 'Ocean',
    mode: 'dark',
    font: 'inter',
    accent: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
    neutrals: n(
      '#07111c #0b1726 #101e30 #1e3047 #182a40 #2b4160 #1e3047 #182a40 #e6f0fa #bfd0e2 #a3b7cd #8197b0 #637a94 #4d617a',
    ),
  },
  {
    id: 'rose',
    name: 'Rose',
    mode: 'light',
    font: 'source',
    accent: ['#be123c', '#9f1239', '#e05a7a'],
    neutrals: n(
      '#f7f3f4 #faf7f8 #fff #e8dfe2 #eee6e8 #d9ccd1 #e9e0e3 #f0e8eb #231a1d #443539 #564549 #72606a #92838a #ac9fa5',
    ),
  },
] as const satisfies readonly PresetSource[];

export type PresetId = (typeof PRESETS)[number]['id'];

export const PRESET_IDS = PRESETS.map((preset) => preset.id) as readonly PresetId[];

export const DEFAULT_PRESET: PresetId = 'light';
