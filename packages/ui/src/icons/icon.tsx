import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Code,
  Cog,
  CornerDownLeft,
  Ellipsis,
  GripVertical,
  Maximize2,
  Menu,
  Plus,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '../lib/cx.ts';
import { SHAPES, type ShapeName } from './shapes.tsx';

/** The text glyphs the mocks set as icons (⌕ ▾ ✕ ··· ⏎), drawn with their Lucide equivalents. */
export const GLYPHS = {
  search: Search,
  caret: ChevronDown,
  'caret-up': ChevronUp,
  chevron: ChevronRight,
  close: X,
  more: Ellipsis,
  expand: Maximize2,
  drag: GripVertical,
  plus: Plus,
  check: Check,
  enter: CornerDownLeft,
  external: ArrowUpRight,
  help: CircleHelp,
  gear: Cog,
  lines: Menu,
  code: Code,
} satisfies Record<string, LucideIcon>;

export type GlyphName = keyof typeof GLYPHS;
export type IconName = ShapeName | GlyphName;

const ALL: Record<IconName, LucideIcon> = { ...SHAPES, ...GLYPHS };

export const ICON_NAMES = Object.keys(ALL) as IconName[];

/**
 * One size system: 16px inside buttons, rows and menus; 18px in the top bar and the sidebar;
 * 14px for the carets and chevrons that sit beside text. Strokes are 1.5px at every size, the
 * width of the borders the mocks draw their icons with.
 */
export const ICON_SIZE = { inline: 16, bar: 18, caret: 14 } as const;
const STROKE = 1.5;

const SMALL: ReadonlySet<IconName> = new Set(['caret', 'caret-up', 'chevron']);

export interface IconProps {
  name: IconName;
  /** Width and height in px; see ICON_SIZE. */
  size?: number;
  /** An accessible name. Without it the icon is decorative and hidden from assistive tech. */
  label?: string;
  className?: string;
}

/** A Lucide icon under the design system's names; it takes the colour of the text around it. */
export function Icon({ name, size, label, className }: IconProps) {
  const Drawn = ALL[name];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };
  return (
    <Drawn
      {...a11y}
      size={size ?? (SMALL.has(name) ? ICON_SIZE.caret : ICON_SIZE.inline)}
      strokeWidth={STROKE}
      absoluteStrokeWidth
      className={cx('inline-block shrink-0', className)}
    />
  );
}
