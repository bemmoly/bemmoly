/** Every colour token name, grouped by role. Order is the order they are emitted in CSS. */

export type ThemeMode = 'light' | 'dark';

export const ACCENT_TOKENS = [
  'ac',
  'ac-d',
  'ac-l',
  'ac-bg',
  'ac-bg2',
  'ac-br',
  'ac-br2',
  'ac-av',
  'ac-mute',
  'ac-fill',
  'on-ac',
] as const;

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

/** Neutrals the mocks use as literals outside the Board mock's :root block. */
export const NEUTRAL_EXTRA_TOKENS = ['sf2', 'br-row', 'br-ctl', 'br-off', 'tx-body'] as const;

/**
 * Reserved for AI-produced content and nothing else (AGENTS.md, Frontend). The mocks draw
 * every AI surface in the accent family, so the values start equal to the accent; components
 * reference only these names, which lets a preset move AI to its own hue without code changes.
 */
export const AI_TOKENS = ['ai', 'ai-mute', 'ai-bg', 'ai-tint', 'ai-br', 'ai-br2', 'ai-tx'] as const;

export const SIGNAL_TOKENS = [
  'ok',
  'ok-fg',
  'ok-bg',
  'danger',
  'danger-hi',
  'warn',
  'warn-fg',
  'warn-bg',
  'caution',
  'violet',
  'on-solid',
  'scrim',
] as const;

export const STATUS_TOKENS = [
  'st-todo-bg',
  'st-todo-fg',
  'st-prog-bg',
  'st-prog-fg',
  'st-rev-bg',
  'st-rev-fg',
  'st-qa-bg',
  'st-qa-fg',
  'st-done-bg',
  'st-done-fg',
] as const;

export const HUES = ['green', 'orange', 'violet', 'pink', 'amber', 'sky'] as const;
export type Hue = (typeof HUES)[number];

export const HUE_TOKENS = HUES.flatMap((hue) => [`${hue}-bg`, `${hue}-fg`] as const);

export const COLOR_TOKENS = [
  ...ACCENT_TOKENS,
  ...NEUTRAL_TOKENS,
  ...NEUTRAL_EXTRA_TOKENS,
  ...AI_TOKENS,
  ...SIGNAL_TOKENS,
  ...STATUS_TOKENS,
  ...HUE_TOKENS,
] as const;

export type NeutralToken = (typeof NEUTRAL_TOKENS)[number];
export type AiToken = (typeof AI_TOKENS)[number];
export type ColorToken = (typeof COLOR_TOKENS)[number];
export type NeutralScale = Readonly<Record<NeutralToken, string>>;
export type ColorSet = Readonly<Record<ColorToken, string>>;
export type AccentTints = Readonly<
  Record<'ac-bg' | 'ac-bg2' | 'ac-br' | 'ac-av' | 'ac-mute', string>
>;
