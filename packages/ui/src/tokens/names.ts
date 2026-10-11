/**
 * Every colour token name, grouped by role. Order is the order they are emitted in CSS. The
 * canonical names are the ones in docs/design/premium/kit.css (ADR 0015); new code uses only
 * these. The names the first release used live on as aliases (aliases.ts) until a later change
 * removes them.
 */

export type ThemeMode = 'light' | 'dark';

/** What a person or workspace chooses: a mode, or "system" to follow the device live. */
export type ModePreference = ThemeMode | 'system';

export const MODE_PREFERENCES = [
  'light',
  'dark',
  'system',
] as const satisfies readonly ModePreference[];

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

/** Every per-theme colour token: canonical, then the legacy hue pairs. */
export const COLOR_TOKENS = [...CANONICAL_COLOR_TOKENS, ...HUE_TOKENS] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
export type ColorSet = Readonly<Record<ColorToken, string>>;

/** The neutral tokens a theme states: four surfaces, two lines, three text greys. */
export const NEUTRAL_TOKENS = [
  'canvas',
  'side',
  'sunken',
  'card',
  'line',
  'line-2',
  'tx',
  'tx-2',
  'tx-3',
] as const;
export type NeutralToken = (typeof NEUTRAL_TOKENS)[number];
export type Neutrals = Readonly<Record<NeutralToken, string>>;

/** The accent tokens a theme states. */
export const THEME_ACCENT_TOKENS = [
  'acc',
  'acc-500',
  'acc-50',
  'acc-100',
  'acc-fill',
  'on-acc',
] as const;

/**
 * The fifteen tokens a theme varies, and nothing else (ADR 0021): every other colour is fixed
 * per mode, and the typeface is its own setting.
 */
export const THEME_TOKENS = [...NEUTRAL_TOKENS, ...THEME_ACCENT_TOKENS] as const;
export type ThemeToken = (typeof THEME_TOKENS)[number];
export type ThemeSet = Readonly<Record<ThemeToken, string>>;

/** Elevations, per theme mode. */
export const ELEVATION_TOKENS = ['e1', 'e1h', 'e2', 'e3'] as const;
export type ElevationToken = (typeof ELEVATION_TOKENS)[number];
export type ElevationSet = Readonly<Record<ElevationToken, string>>;
