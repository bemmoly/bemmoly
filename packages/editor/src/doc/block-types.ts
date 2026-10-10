import type { IconName } from '@bemmoly/ui/icons';
import type { ChainedCommands, Editor } from '@tiptap/core';

/*
 * The block types a block can turn into: one list behind the selection bubble's "Text" menu,
 * the block menu's Turn into and the / menu's Basic group, so the three never disagree on a
 * name, an icon or a shortcut. Each turn first lifts the block out of a list or a quote, so
 * "Text" always gives back a plain paragraph.
 */

export interface BlockType {
  id: string;
  label: string;
  /** The / menu's second line. */
  description: string;
  icon: IconName;
  /** In ProseMirror's notation; the schema's own shortcut for the type. */
  keys?: string;
  /** The Markdown a person can type instead, shown at the row's end. */
  markdown?: string;
  active: (editor: Editor) => boolean;
  turn: (chain: ChainedCommands) => ChainedCommands;
}

const inList = (editor: Editor) =>
  editor.isActive('bulletList') || editor.isActive('orderedList') || editor.isActive('taskList');

export const BLOCK_TYPES: readonly BlockType[] = [
  {
    id: 'text',
    label: 'Text',
    description: 'Just start writing',
    icon: 'text',
    keys: 'Mod-Alt-0',
    active: (e) =>
      e.isActive('paragraph') && !inList(e) && !e.isActive('blockquote') && !e.isActive('callout'),
    turn: (c) => c.clearNodes().setParagraph(),
  },
  {
    id: 'heading',
    label: 'Heading',
    description: 'A section title, in the outline',
    icon: 'heading',
    keys: 'Mod-Alt-2',
    markdown: '##',
    active: (e) => e.isActive('heading', { level: 2 }),
    turn: (c) => c.clearNodes().setHeading({ level: 2 }),
  },
  {
    id: 'subheading',
    label: 'Subheading',
    description: 'A smaller title inside a section',
    icon: 'subheading',
    keys: 'Mod-Alt-3',
    markdown: '###',
    active: (e) => e.isActive('heading', { level: 3 }),
    turn: (c) => c.clearNodes().setHeading({ level: 3 }),
  },
  {
    id: 'bulletList',
    label: 'Bulleted list',
    description: 'A simple list',
    icon: 'list',
    keys: 'Mod-Shift-8',
    markdown: '-',
    active: (e) => e.isActive('bulletList'),
    turn: (c) => c.clearNodes().toggleBulletList(),
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    description: 'Steps in order',
    icon: 'numbered',
    keys: 'Mod-Shift-7',
    markdown: '1.',
    active: (e) => e.isActive('orderedList'),
    turn: (c) => c.clearNodes().toggleOrderedList(),
  },
  {
    id: 'taskList',
    label: 'To-do list',
    description: 'Checkboxes people can tick',
    icon: 'checklist',
    keys: 'Mod-Shift-9',
    markdown: '[]',
    active: (e) => e.isActive('taskList'),
    turn: (c) => c.clearNodes().toggleTaskList(),
  },
  {
    id: 'blockquote',
    label: 'Quote',
    description: 'Words from someone else',
    icon: 'quote',
    keys: 'Mod-Shift-b',
    markdown: '>',
    active: (e) => e.isActive('blockquote'),
    turn: (c) => c.clearNodes().toggleBlockquote(),
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    description: 'With a language and copy',
    icon: 'code',
    keys: 'Mod-Alt-c',
    markdown: '```',
    active: (e) => e.isActive('codeBlock'),
    turn: (c) => c.clearNodes().setCodeBlock(),
  },
];

/** The type the selection's block is now: the first that answers, else Text. */
export function currentBlockType(editor: Editor): BlockType {
  const ordered = [...BLOCK_TYPES.slice(1), BLOCK_TYPES[0]!];
  return ordered.find((type) => type.active(editor)) ?? BLOCK_TYPES[0]!;
}
