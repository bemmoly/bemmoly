import { shortcutText } from '@bemmoly/ui';
import type { IconName } from '@bemmoly/ui/icons';
import type { ChainedCommands, Editor } from '@tiptap/core';

/*
 * What the tool row and the / menu can do. The row's glyphs are the comment composer's in the
 * Issue mock (B, I, @, Link, Code), with the block tools after them where a field holds longer
 * text. Shortcuts are the schema's own, plus ⌘K for a link.
 */

export interface ToolContext {
  /** Opens the link form over the selection. */
  openLink: () => void;
}

export interface Tool {
  id: string;
  /** What the button shows. */
  glyph: string;
  /** What the button is called. */
  label: string;
  /** The drawing where a surface shows icons instead of glyphs (the Docs selection bubble). */
  icon?: IconName;
  /** In ProseMirror's notation: Mod-b. */
  keys?: string;
  /** Toggles report their state with aria-pressed. */
  active?: (editor: Editor) => boolean;
  run: (editor: Editor, context: ToolContext) => void;
}

const chain = (editor: Editor) => editor.chain().focus();

/** Starts an @mention at the caret, with a space before it when the caret follows a word. */
function startMention(editor: Editor) {
  const { $from } = editor.state.selection;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset);
  chain(editor)
    .insertContent(before && !/\s/.test(before) ? ' @' : '@')
    .run();
}

export const INLINE_TOOLS: readonly Tool[] = [
  {
    id: 'bold',
    icon: 'bold',
    glyph: 'B',
    label: 'Bold',
    keys: 'Mod-b',
    active: (e) => e.isActive('bold'),
    run: (e) => chain(e).toggleBold().run(),
  },
  {
    id: 'italic',
    icon: 'italic',
    glyph: 'I',
    label: 'Italic',
    keys: 'Mod-i',
    active: (e) => e.isActive('italic'),
    run: (e) => chain(e).toggleItalic().run(),
  },
  { id: 'mention', glyph: '@', label: 'Mention someone', run: startMention },
  {
    id: 'link',
    icon: 'link',
    glyph: 'Link',
    label: 'Link',
    keys: 'Mod-k',
    active: (e) => e.isActive('link'),
    run: (_e, context) => context.openLink(),
  },
  {
    id: 'code',
    icon: 'code',
    glyph: 'Code',
    label: 'Inline code',
    keys: 'Mod-e',
    active: (e) => e.isActive('code'),
    run: (e) => chain(e).toggleCode().run(),
  },
];

const STRIKE: Tool = {
  id: 'strike',
  icon: 'strike',
  glyph: 'S',
  label: 'Strikethrough',
  keys: 'Mod-Shift-s',
  active: (e) => e.isActive('strike'),
  run: (e) => chain(e).toggleStrike().run(),
};

const HIGHLIGHT: Tool = {
  id: 'highlight',
  icon: 'highlight',
  glyph: 'H',
  label: 'Highlight',
  keys: 'Mod-Shift-h',
  active: (e) => e.isActive('highlight'),
  run: (e) => chain(e).toggleHighlight().run(),
};

const inline = (id: string) => INLINE_TOOLS.find((tool) => tool.id === id)!;

/** The Docs selection bubble's marks, in the review's order: B I S code link highlight. */
export const BUBBLE_TOOLS: readonly Tool[] = [
  inline('bold'),
  inline('italic'),
  STRIKE,
  inline('code'),
  inline('link'),
  HIGHLIGHT,
];

export const BLOCK_TOOLS: readonly Tool[] = [
  {
    id: 'heading',
    glyph: 'Heading',
    label: 'Heading',
    keys: 'Mod-Alt-2',
    active: (e) => e.isActive('heading'),
    run: (e) => chain(e).toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'bulletList',
    glyph: 'List',
    label: 'Bulleted list',
    keys: 'Mod-Shift-8',
    active: (e) => e.isActive('bulletList'),
    run: (e) => chain(e).toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    glyph: 'Numbered',
    label: 'Numbered list',
    keys: 'Mod-Shift-7',
    active: (e) => e.isActive('orderedList'),
    run: (e) => chain(e).toggleOrderedList().run(),
  },
  {
    id: 'taskList',
    glyph: 'Checklist',
    label: 'Checklist',
    keys: 'Mod-Shift-9',
    active: (e) => e.isActive('taskList'),
    run: (e) => chain(e).toggleTaskList().run(),
  },
  {
    id: 'blockquote',
    glyph: 'Quote',
    label: 'Quote',
    keys: 'Mod-Shift-b',
    active: (e) => e.isActive('blockquote'),
    run: (e) => chain(e).toggleBlockquote().run(),
  },
  {
    id: 'codeBlock',
    glyph: 'Code block',
    label: 'Code block',
    keys: 'Mod-Alt-c',
    active: (e) => e.isActive('codeBlock'),
    run: (e) => chain(e).toggleCodeBlock().run(),
  },
];

export interface SlashBlock {
  id: string;
  label: string;
  run: (chain: ChainedCommands) => ChainedCommands;
}

/** The / menu's Blocks section, in the Doc Editor mock's menu. */
export const SLASH_BLOCKS: readonly SlashBlock[] = [
  { id: 'heading', label: 'Heading', run: (c) => c.setHeading({ level: 2 }) },
  { id: 'subheading', label: 'Subheading', run: (c) => c.setHeading({ level: 3 }) },
  { id: 'bulletList', label: 'Bulleted list', run: (c) => c.toggleBulletList() },
  { id: 'orderedList', label: 'Numbered list', run: (c) => c.toggleOrderedList() },
  { id: 'taskList', label: 'Checklist', run: (c) => c.toggleTaskList() },
  { id: 'blockquote', label: 'Quote', run: (c) => c.toggleBlockquote() },
  { id: 'codeBlock', label: 'Code block', run: (c) => c.toggleCodeBlock() },
  { id: 'horizontalRule', label: 'Divider', run: (c) => c.setHorizontalRule() },
];

/** The blocks whose name starts a word matching the query, case-insensitively. */
export function slashMatches(query: string): SlashBlock[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...SLASH_BLOCKS];
  return SLASH_BLOCKS.filter((block) =>
    block.label
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(q)),
  );
}

const MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform);

/** "Mod-Shift-8" as the person's keyboard writes it, for a tooltip: Command symbols or Ctrl+Shift+8. */
export function keyLabel(keys: string): string {
  return shortcutText(keys.replace(/-/g, '+'), MAC);
}

/** "Mod-Shift-8" for aria-keyshortcuts: Meta+Shift+8 on a Mac, Control+Shift+8 elsewhere. */
export function ariaKeys(keys: string): string {
  return keys
    .split('-')
    .map((part) => {
      if (part === 'Mod') return MAC ? 'Meta' : 'Control';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join('+');
}
