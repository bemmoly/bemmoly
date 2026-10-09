/*
 * Small builders for ProseMirror JSON in the editor's base schema (Tiptap's
 * default node names), so the built-in templates read as outlines rather than
 * nested objects. Only nodes the base schema has: heading 1-3, paragraph,
 * bulletList, orderedList, taskList, blockquote, horizontalRule, bold marks.
 */

export interface PmNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: PmNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

const text = (value: string, bold = false): PmNode =>
  bold ? { type: 'text', text: value, marks: [{ type: 'bold' }] } : { type: 'text', text: value };

export const doc = (...content: PmNode[]): PmNode => ({ type: 'doc', content });

export const h = (level: 1 | 2 | 3, value: string): PmNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

/** A paragraph; an empty one is a blank line to type into. */
export const p = (value = ''): PmNode =>
  value ? { type: 'paragraph', content: [text(value)] } : { type: 'paragraph' };

/** "Label: value" with the label in bold, for metadata lines. */
export const field = (label: string, value = ''): PmNode => ({
  type: 'paragraph',
  content: value ? [text(`${label}: `, true), text(value)] : [text(`${label}:`, true)],
});

const item = (type: 'listItem' | 'taskItem', value: string): PmNode => ({
  type,
  ...(type === 'taskItem' ? { attrs: { checked: false } } : {}),
  content: [p(value)],
});

export const bullets = (...items: string[]): PmNode => ({
  type: 'bulletList',
  content: items.map((value) => item('listItem', value)),
});

export const numbered = (...items: string[]): PmNode => ({
  type: 'orderedList',
  attrs: { start: 1, type: null },
  content: items.map((value) => item('listItem', value)),
});

export const tasks = (...items: string[]): PmNode => ({
  type: 'taskList',
  content: items.map((value) => item('taskItem', value)),
});

export const quote = (value: string): PmNode => ({ type: 'blockquote', content: [p(value)] });

export const rule = (): PmNode => ({ type: 'horizontalRule' });
