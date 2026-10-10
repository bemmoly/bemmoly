/**
 * Non-colour tokens. They do not change between presets, so they are emitted once. METRICS
 * become runtime CSS variables; the scales below become Tailwind theme keys (text-12,
 * rounded-card, ...). The scales are the design review's diet (ADR 0015); the first release's
 * steps stay as aliases on the nearest step until a later change removes them.
 */

export const METRICS = {
  'text-base': '13px',
  'text-nav': '13px',
  'text-brand': '14px',
  'text-mono': '11px',
  'radius-control': '6px',
  'size-control': '32px',
  'size-topbar': '48px',
} as const;

/** Seven sizes: meta, secondary, UI default, reading, section, page title, greeting. */
export const TYPE_STEPS = {
  '11': '11px',
  '12': '12px',
  '13': '13px',
  '14': '14px',
  '16': '16px',
  '20': '20px',
  '24': '24px',
} as const;

/** The first release's sizes, each on its nearest step by role. `h` was a half pixel. */
export const TYPE_ALIASES = {
  '9': '11',
  '9h': '11',
  '10': '11',
  '10h': '11',
  '11h': '12',
  '12h': '13',
  '13h': '13',
  '15': '16',
  '15h': '16',
  '18': '16',
  '22': '20',
  '26': '24',
  '36': '24',
} as const satisfies Record<string, keyof typeof TYPE_STEPS>;

export const TYPE_SCALE = {
  ...TYPE_STEPS,
  ...Object.fromEntries(
    Object.entries(TYPE_ALIASES).map(([alias, step]) => [alias, TYPE_STEPS[step]]),
  ),
} as Readonly<Record<keyof typeof TYPE_STEPS | keyof typeof TYPE_ALIASES, string>>;

/**
 * Four radii and full: chips 4, controls 6, cards 8, dialogs 12. Marks smaller than 12px (epic
 * swatches, progress bars) keep the review's 2px, so a square swatch still reads as a square
 * beside a label's round dot.
 */
export const RADIUS_STEPS = {
  tick: '2px',
  chip: '4px',
  control: '6px',
  card: '8px',
  dialog: '12px',
  full: '9999px',
} as const;

/** The first release's radii on the nearest step. */
export const RADIUS_ALIASES = {
  hair: 'tick',
  xs: 'chip',
  sm: 'chip',
  panel: 'control',
  pill: 'full',
} as const satisfies Record<string, keyof typeof RADIUS_STEPS>;

export const RADII = {
  ...RADIUS_STEPS,
  ...Object.fromEntries(
    Object.entries(RADIUS_ALIASES).map(([alias, step]) => [alias, RADIUS_STEPS[step]]),
  ),
} as Readonly<Record<keyof typeof RADIUS_STEPS | keyof typeof RADIUS_ALIASES, string>>;

export const LEADING = {
  display: '1.15',
  title: '1.3',
  card: '1.4',
  note: '1.45',
  body: '1.5',
  brief: '1.55',
  desc: '1.6',
  doc: '1.65',
  prose: '1.7',
} as const;

export const TRACKING = {
  display: '-.02em',
  title: '-.015em',
  brand: '-.01em',
  status: '.04em',
  caps: '.06em',
  label: '.07em',
  dots: '1px',
  grip: '-2px',
} as const;

/**
 * Shadows that are rings rather than elevation; elevations (e1, e2, e3 and their old names)
 * are per theme mode, in semantic.ts.
 */
export const SHADOWS = {
  ring: '0 0 0 2px var(--acc-100)',
  'ring-ac': '0 0 0 2px var(--acc)',
  /** The selected workflow status node: a 3px ring of the accent border. */
  'ring-node': '0 0 0 3px var(--acc-100)',
  /** Active tab and top bar item underline. */
  tab: 'inset 0 -2px 0 var(--acc)',
  /** Selected radio: card-coloured gap, then the accent dot. */
  radio: 'inset 0 0 0 4px var(--card), inset 0 0 0 9px var(--acc-fill)',
  /** Overlapping avatars: a 1px page-coloured halo outside the 2px ring. */
  halo: '0 0 0 1px var(--sunken)',
} as const;
