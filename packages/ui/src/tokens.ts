/**
 * The single source of truth for design tokens. Values are copied from the
 * mocks in docs/design/mocks: neutral scales, accent triplets and fonts per
 * preset from the theme table of the Board mock, the Classic accent tints from
 * that mock's :root block, and the preset list from the Setup and Appearance
 * Settings mocks. theme.css and tailwind.css are generated from this file.
 */

export type ThemeMode = 'light' | 'dark';

export const NEUTRAL_TOKENS = [
  'bg',
  'bg2',
  'sf',
  'br',
  'br2',
  'br3',
  'trk',
  'chip',
  'tx',
  'tx2',
  'tx3',
  'tx4',
  'tx5',
  'tx6',
] as const;
export const ACCENT_TOKENS = [
  'ac',
  'ac-d',
  'ac-l',
  'ac-bg',
  'ac-bg2',
  'ac-br',
  'ac-av',
  'ac-mute',
  'on-ac',
] as const;
export const COLOR_TOKENS = [...ACCENT_TOKENS, ...NEUTRAL_TOKENS] as const;

export type NeutralToken = (typeof NEUTRAL_TOKENS)[number];
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type NeutralScale = Readonly<Record<NeutralToken, string>>;
export type AccentTints = Readonly<
  Record<'ac-bg' | 'ac-bg2' | 'ac-br' | 'ac-av' | 'ac-mute', string>
>;

const SYSTEM_SANS =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export const FONTS = {
  plex: { name: 'IBM Plex Sans', stack: `'IBM Plex Sans', ${SYSTEM_SANS}` },
  inter: { name: 'Inter Tight', stack: `'Inter Tight', 'IBM Plex Sans', ${SYSTEM_SANS}` },
  source: { name: 'Source Sans 3', stack: `'Source Sans 3', 'IBM Plex Sans', ${SYSTEM_SANS}` },
  geist: { name: 'Geist', stack: `'Geist', 'IBM Plex Sans', ${SYSTEM_SANS}` },
} as const;

export type FontId = keyof typeof FONTS;

export const MONO_STACK =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

/** Non-colour tokens, measured from the mocks. */
export const METRICS = {
  'text-base': '13px',
  'text-nav': '13.5px',
  'text-brand': '14px',
  'text-mono': '11px',
  'radius-control': '6px',
  'size-control': '32px',
  'size-topbar': '48px',
} as const;

export interface PresetSource {
  id: string;
  name: string;
  mode: ThemeMode;
  /** [accent, darker accent, lighter accent] */
  accent: readonly [string, string, string];
  neutrals: NeutralScale;
  font: FontId;
  /** Exact tints where a mock states them; otherwise derived by `accentTints`. */
  tints?: AccentTints;
}

const n = (values: string): NeutralScale => {
  const parts = values.split(' ');
  return Object.fromEntries(NEUTRAL_TOKENS.map((token, i) => [token, parts[i]])) as NeutralScale;
};

export const PRESETS = [
  {
    id: 'light',
    name: 'Classic',
    mode: 'light',
    font: 'plex',
    accent: ['#2456c9', '#183d94', '#6a8fe8'],
    neutrals: n(
      '#f4f5f7 #f9fafb #fff #e2e5ea #e9ecf0 #d5dae2 #e5e8ee #eef0f4 #1b2430 #3b4454 #4b5565 #6b7483 #8a93a3 #a2aab8',
    ),
    tints: {
      'ac-bg': '#eef3fe',
      'ac-bg2': '#f6f8fe',
      'ac-br': '#cdd8f3',
      'ac-av': '#d7e3fb',
      'ac-mute': '#7a93d9',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'dark',
    font: 'plex',
    accent: ['#5b8def', '#3b6fd6', '#8db0f5'],
    neutrals: n(
      '#0f1217 #141821 #1a1f29 #262c38 #222834 #323a48 #2a3140 #262c38 #e9edf3 #c3c9d4 #aab2bf #8b94a3 #6c7585 #566070',
    ),
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

/** Text on an accent fill, as in the mock's primary button. */
export const ON_ACCENT = '#fff';

const mix = (color: string, percent: number, base: string): string =>
  `color-mix(in oklab, ${color} ${percent}%, ${base})`;

/** The Board mock's derivation of accent tints from the accent and the surface. */
export function accentTints(accent: string, mode: ThemeMode, surface: string): AccentTints {
  const dark = mode === 'dark';
  const base = dark ? surface : '#fff';
  return {
    'ac-bg': mix(accent, dark ? 18 : 9, base),
    'ac-bg2': mix(accent, dark ? 10 : 5, base),
    'ac-br': mix(accent, dark ? 35 : 22, base),
    'ac-av': mix(accent, dark ? 30 : 18, base),
    'ac-mute': mix(accent, 55, base),
  };
}

export interface ResolvedTheme {
  id: PresetId;
  name: string;
  mode: ThemeMode;
  colors: Readonly<Record<ColorToken, string>>;
  fontUi: string;
  fontCode: string;
}

export function resolvePreset(preset: PresetSource): ResolvedTheme {
  const [ac, acD, acL] = preset.accent;
  const tints = preset.tints ?? accentTints(ac, preset.mode, preset.neutrals.sf);
  return {
    id: preset.id as PresetId,
    name: preset.name,
    mode: preset.mode,
    colors: { ac, 'ac-d': acD, 'ac-l': acL, ...tints, 'on-ac': ON_ACCENT, ...preset.neutrals },
    fontUi: FONTS[preset.font].stack,
    fontCode: MONO_STACK,
  };
}

export const THEMES: readonly ResolvedTheme[] = PRESETS.map(resolvePreset);

export function themeById(id: string): ResolvedTheme {
  return THEMES.find((theme) => theme.id === id) ?? (THEMES[0] as ResolvedTheme);
}
