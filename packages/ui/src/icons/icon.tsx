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
import { KIT_ICONS, type KitIconName } from './kit.tsx';
import { SHAPES, type ShapeName } from './shapes.tsx';

/** The text glyphs the mocks set as icons (search, caret, close, more, enter), drawn instead. */
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
export type IconName = ShapeName | GlyphName | KitIconName;

const ALL: Record<IconName, LucideIcon> = { ...SHAPES, ...GLYPHS, ...KIT_ICONS };

export const ICON_NAMES = Object.keys(ALL) as IconName[];

/**
 * One size system: 16px inside buttons, rows, menus and dropdown carets; 18px in the top bar
 * and the sidebar; 14px in small controls. The stroke is 1.75px at every size (ADR 0015).
 */
export const ICON_SIZE = { inline: 16, bar: 18, small: 14 } as const;
const STROKE = 1.75;

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
      size={size ?? ICON_SIZE.inline}
      strokeWidth={STROKE}
      absoluteStrokeWidth
      className={cx('inline-block shrink-0', className)}
    />
  );
}
