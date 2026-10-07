import { cx } from '../lib/cx.ts';
import { SHAPES, type ShapeDef, type ShapeName } from './shapes.tsx';

/**
 * Text glyphs the mocks use as icons, with the size and weight each is set in. They are kept
 * as text, as in the mocks, so they render identically.
 */
export const GLYPHS = {
  search: { char: '⌕', className: 'text-14' },
  caret: { char: '▾', className: 'text-10' },
  'caret-up': { char: '▴', className: 'text-10' },
  chevron: { char: '▶', className: 'text-10' },
  close: { char: '✕', className: 'font-semibold' },
  more: { char: '···', className: 'font-semibold tracking-dots' },
  expand: { char: '⤢', className: 'font-semibold' },
  drag: { char: '⋮⋮', className: 'tracking-grip' },
  plus: { char: '+', className: 'font-semibold' },
  check: { char: '✓', className: '' },
  enter: { char: '⏎', className: 'font-mono text-11 font-medium' },
  external: { char: '↗', className: '' },
  help: { char: '?', className: 'text-14 font-semibold' },
  gear: { char: '⚙', className: '' },
  lines: { char: '≡', className: '' },
  code: { char: '</>', className: 'font-mono text-12 font-medium' },
} as const;

export type GlyphName = keyof typeof GLYPHS;
export type IconName = ShapeName | GlyphName;

export const ICON_NAMES = [...Object.keys(SHAPES), ...Object.keys(GLYPHS)] as IconName[];

export interface IconProps {
  name: IconName;
  /** Width in px for drawn icons (height keeps the mock's ratio); font size for glyphs. */
  size?: number;
  /** An accessible name. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
}

const isShape = (name: IconName): name is ShapeName => name in SHAPES;

export function Icon({ name, size, label, className }: IconProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  if (isShape(name)) {
    const def: ShapeDef = SHAPES[name];
    const width = size ?? def.w;
    const height = (width / def.w) * def.h;
    return (
      <svg
        {...a11y}
        width={width}
        height={height}
        viewBox={`0 0 ${def.w} ${def.h}`}
        overflow="visible"
        className={cx('inline-block shrink-0', className)}
      >
        {def.body}
      </svg>
    );
  }
  const glyph = GLYPHS[name];
  return (
    <span
      {...a11y}
      className={cx('inline-block shrink-0 leading-none', glyph.className, className)}
      style={size ? { fontSize: size } : undefined}
    >
      {glyph.char}
    </span>
  );
}
