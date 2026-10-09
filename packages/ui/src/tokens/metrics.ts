/**
 * Non-colour tokens, measured from the mocks. They do not change between presets, so they
 * are emitted once. METRICS become runtime CSS variables; the scales below become Tailwind
 * theme keys (text-12h, rounded-card, shadow-menu, ...).
 */

export const METRICS = {
  'text-base': '13px',
  'text-nav': '13.5px',
  'text-brand': '14px',
  'text-mono': '11px',
  'radius-control': '6px',
  'size-control': '32px',
  'size-topbar': '48px',
} as const;

/** Font sizes in the mocks. `h` is a half pixel: text-12h is 12.5px. */
export const TYPE_SCALE = {
  '9': '9px',
  '9h': '9.5px',
  '10': '10px',
  '10h': '10.5px',
  '11': '11px',
  '11h': '11.5px',
  '12': '12px',
  '12h': '12.5px',
  '13': '13px',
  '13h': '13.5px',
  '14': '14px',
  '15': '15px',
  '15h': '15.5px',
  '16': '16px',
  '18': '18px',
  '22': '22px',
  '24': '24px',
  '26': '26px',
  '36': '36px',
} as const;

/** Corner radii in the mocks, named by where they appear. */
export const RADII = {
  hair: '1px',
  tick: '2px',
  chip: '3px',
  xs: '4px',
  sm: '5px',
  control: '6px',
  panel: '7px',
  card: '8px',
  pill: '9px',
  dialog: '12px',
  full: '9999px',
} as const;

export const LEADING = {
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

/** Shadows from the mocks. `ring` is the selected-card ring (0 0 0 2px of the accent border). */
export const SHADOWS = {
  card: '0 1px 2px rgba(16,24,40,.05)',
  seg: '0 1px 1px rgba(0,0,0,.06)',
  pop: '0 2px 8px rgba(16,24,40,.06)',
  menu: '0 8px 24px rgba(16,24,40,.12)',
  modal: '0 24px 64px rgba(16,24,40,.35),0 0 0 1px rgba(16,24,40,.08)',
  ring: '0 0 0 2px var(--ac-br)',
  'ring-ac': '0 0 0 2px var(--ac)',
  /** The selected workflow status node (Workflow mock): a 3px ring of the accent border. */
  'ring-node': '0 0 0 3px var(--ac-br)',
  /** Active tab and top bar item underline. */
  tab: 'inset 0 -2px 0 var(--ac)',
  /** Selected radio: white gap, then the accent dot (Board Settings). */
  radio: 'inset 0 0 0 4px var(--sf), inset 0 0 0 9px var(--ac-fill)',
  /** Board filter avatars: a 1px page-coloured halo outside the 2px ring. */
  halo: '0 0 0 1px var(--bg)',
} as const;
