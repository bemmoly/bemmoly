/**
 * Every colour token name, grouped by role. Order is the order they are emitted in CSS. The
 * canonical names are the ones in docs/design/premium/kit.css (ADR 0015); new code uses only
 * these. The names the first release used live on as aliases (aliases.ts) until a later change
 * removes them.
 */

export type ThemeMode = 'light' | 'dark';

/** Three surfaces, the sidebar's own, and the hover and press overlays drawn on any of them. */
export const SURFACE_TOKENS = ['canvas', 'side', 'sunken', 'card', 'hover', 'press'] as const;

/** Two lines: borders and dividers. */
export const LINE_TOKENS = ['line', 'line-2'] as const;

/** Three text greys, every one at least 4.5:1 on every surface. */
export const TEXT_TOKENS = ['tx', 'tx-2', 'tx-3'] as const;

/**
 * The accent: `acc` for text, icons and lines; `acc-fill` behind on-accent text (it differs
 * from `acc` only where white text would fail on the brand colour); 600 is the pressed fill.
 */
export const ACCENT_TOKENS = [
  'acc',
  'acc-600',
  'acc-500',
  'acc-100',
  'acc-50',
  'acc-fill',
  'on-acc',
] as const;

/**
 * Reserved for AI-produced content and nothing else (AGENTS.md, Frontend): the logo's lilac.
 * `ai` fills and marks, `ai-600` is AI text, `ai-100` borders and `ai-50` backgrounds.
 */
export const AI_TOKENS = ['ai', 'ai-600', 'ai-100', 'ai-50'] as const;

/** Status categories: the colour of a status glyph is its category, whatever its name. */
export const STATUS_TOKENS = ['todo', 'prog', 'done'] as const;

/** Signal colours: a solid, a text-safe ink and a background each. */
export const SIGNAL_TOKENS = [
  'red',
  'red-tx',
  'red-50',
  'amber',
  'amber-tx',
  'amber-50',
  'green',
  'green-tx',
  'green-50',
  'on-solid',
  'scrim',
] as const;

/**
 * Pastel pairs the first release drew avatars, tags and epic lanes with. Kept until the screens
 * that still use them move to the avatar and epic families; not for new code.
 */
export const HUES = ['green', 'orange', 'violet', 'pink', 'amber', 'sky'] as const;
export type Hue = (typeof HUES)[number];

export const HUE_TOKENS = HUES.flatMap((hue) => [`${hue}-bg`, `${hue}-fg`] as const);

export const CANONICAL_COLOR_TOKENS = [
  ...SURFACE_TOKENS,
  ...LINE_TOKENS,
  ...TEXT_TOKENS,
  ...ACCENT_TOKENS,
  ...AI_TOKENS,
  ...STATUS_TOKENS,
  ...SIGNAL_TOKENS,
] as const;

export type CanonicalColorToken = (typeof CANONICAL_COLOR_TOKENS)[number];

/** Old name → canonical name. Each alias resolves to exactly its target's value. */
export const COLOR_ALIASES = {
  // accent
  ac: 'acc',
  'ac-d': 'acc-600',
  'ac-l': 'acc-500',
  'ac-bg': 'acc-50',
  'ac-bg2': 'acc-50',
  'ac-br': 'acc-100',
  'ac-br2': 'acc-100',
  'ac-av': 'acc-100',
  'ac-mute': 'acc-500',
  'ac-fill': 'acc-fill',
  'on-ac': 'on-acc',
  // surfaces and lines
  bg: 'sunken',
  bg2: 'side',
  sf: 'card',
  sf2: 'side',
  br: 'line',
  br2: 'line-2',
  br3: 'line',
  'br-row': 'line-2',
  'br-off': 'line',
  trk: 'line',
  chip: 'line-2',
  // Control outlines (checkbox, radio) must reach 3:1, which no line does.
  'br-ctl': 'tx-3',
  // text
  tx2: 'tx-2',
  tx3: 'tx-2',
  tx4: 'tx-3',
  tx5: 'tx-3',
  tx6: 'tx-3',
  'tx-body': 'tx',
  // AI
  'ai-mute': 'ai',
  'ai-bg': 'ai-50',
  'ai-tint': 'ai-50',
  'ai-br': 'ai-100',
  'ai-br2': 'ai-100',
  'ai-tx': 'tx',
  // signal
  ok: 'green',
  'ok-fg': 'green-tx',
  'ok-bg': 'green-50',
  danger: 'red',
  'danger-hi': 'red-tx',
  warn: 'amber',
  'warn-fg': 'amber-tx',
  'warn-bg': 'amber-50',
  caution: 'amber',
  // status pills: the category's colour, so review and QA read as in progress
  'st-todo-bg': 'line-2',
  'st-todo-fg': 'tx-2',
  'st-prog-bg': 'acc-50',
  'st-prog-fg': 'acc',
  'st-rev-bg': 'acc-50',
  'st-rev-fg': 'acc',
  'st-qa-bg': 'acc-50',
  'st-qa-fg': 'acc',
  'st-done-bg': 'green-50',
  'st-done-fg': 'green-tx',
} as const satisfies Record<string, CanonicalColorToken>;

export type ColorAlias = keyof typeof COLOR_ALIASES;

export const ALIAS_TOKENS = Object.keys(COLOR_ALIASES) as ColorAlias[];

/** Every per-theme colour token: canonical, then the legacy hue pairs, then the aliases. */
export const COLOR_TOKENS = [...CANONICAL_COLOR_TOKENS, ...HUE_TOKENS, ...ALIAS_TOKENS] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorSet = Readonly<Record<ColorToken, string>>;

/** The reduced neutral set each preset states. */
export type Neutrals = Readonly<
  Record<'canvas' | 'side' | 'sunken' | 'card' | 'line' | 'line-2' | 'tx' | 'tx-2' | 'tx-3', string>
>;

/** Elevations, and the first release's shadow names mapped onto them, per theme mode. */
export const ELEVATION_TOKENS = [
  'e1',
  'e1h',
  'e2',
  'e3',
  'shadow-card',
  'shadow-seg',
  'shadow-pop',
  'shadow-menu',
  'shadow-modal',
] as const;
export type ElevationToken = (typeof ELEVATION_TOKENS)[number];
export type ElevationSet = Readonly<Record<ElevationToken, string>>;
