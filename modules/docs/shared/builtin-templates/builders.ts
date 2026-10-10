/*
 * Small builders for ProseMirror JSON in the editor's schema (Tiptap's default
 * node names plus the Docs nodes), so the built-in templates read as outlines
 * rather than nested objects. Each writes every attribute the editor writes,
 * so a template loads and saves back unchanged.
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

/** A tinted box around blocks; info is the mock's TL;DR tint. */
export const callout = (
  variant: 'info' | 'note' | 'success' | 'warning' | 'danger',
  ...content: PmNode[]
): PmNode => ({ type: 'callout', attrs: { variant }, content });

/** A decision block, proposed until the deciders mark it. */
export const decision = (...content: PmNode[]): PmNode => ({
  type: 'decision',
  attrs: { state: 'proposed', decidedOn: null },
  content,
});

/** The page's headings, kept current by the editor. */
export const toc = (): PmNode => ({ type: 'toc', attrs: { maxLevel: 3 } });

const cell = (type: 'tableHeader' | 'tableCell', value: string): PmNode => ({
  type,
  attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
  content: [p(value)],
});

/** A table with a header row; rows shorter than the header get empty cells. */
export const table = (header: string[], ...rows: string[][]): PmNode => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: header.map((value) => cell('tableHeader', value)) },
    ...rows.map((row) => ({
      type: 'tableRow',
      content: header.map((_, index) => cell('tableCell', row[index] ?? '')),
    })),
  ],
});
