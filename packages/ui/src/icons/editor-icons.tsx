import {
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Columns3,
  FileText,
  Heading2,
  Heading3,
  Highlighter,
  ListOrdered,
  ListTree,
  PanelTop,
  Quote,
  Rows3,
  Scale,
  SeparatorHorizontal,
  StickyNote,
  Strikethrough,
  Trash2,
  Type,
  Unlink,
  type LucideIcon,
} from 'lucide-react';

/**
 * The writing surface's drawings: block types in the / menu and the block menu, the marks in
 * the selection bubble, and the table tools (the Docs review's Writing and Formatting tabs).
 */
export const EDITOR_ICONS = {
  text: Type,
  strike: Strikethrough,
  highlight: Highlighter,
  heading: Heading2,
  subheading: Heading3,
  numbered: ListOrdered,
  quote: Quote,
  divider: SeparatorHorizontal,
  callout: StickyNote,
  outline: ListTree,
  decision: Scale,
  page: FileText,
  unlink: Unlink,
  'row-add': BetweenHorizontalEnd,
  'column-add': BetweenVerticalEnd,
  'header-row': PanelTop,
  'row-remove': Rows3,
  'column-remove': Columns3,
  'trash-can': Trash2,
} satisfies Record<string, LucideIcon>;

export type EditorIconName = keyof typeof EDITOR_ICONS;
