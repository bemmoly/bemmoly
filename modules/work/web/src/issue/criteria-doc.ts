import type { RichText } from '@bemmoly/module-work/shared';

/*
 * Acceptance criteria are stored as a rich text field, so they print anywhere a document does.
 * The Issue page reads them as a checklist: every task item, list item or paragraph is one
 * criterion, and the page writes them back as one task list.
 */

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

export interface Criterion {
  text: string;
  checked: boolean;
  /** The criterion's paragraph as stored, so its marks and mentions survive a tick. */
  content?: Node[];
}

const textOf = (node: Node): string =>
  typeof node.text === 'string'
    ? node.text
    : node.type === 'mention'
      ? `@${String(node.attrs?.label ?? '')}`
      : (node.content ?? []).map(textOf).join('');

const LISTS = new Set(['taskList', 'bulletList', 'orderedList']);

function collect(node: Node, out: Criterion[]): void {
  if (node.type === 'taskItem' || node.type === 'listItem') {
    const text = textOf(node).trim();
    const paragraph = node.content?.[0];
    if (text) {
      out.push({
        text,
        checked: node.type === 'taskItem' && node.attrs?.checked === true,
        ...(paragraph?.type === 'paragraph' && paragraph.content
          ? { content: paragraph.content }
          : {}),
      });
    }
    return;
  }
  if (node.type && LISTS.has(node.type)) {
    for (const child of node.content ?? []) collect(child, out);
    return;
  }
  if (node.type === 'paragraph' || node.type === 'heading') {
    const text = textOf(node).trim();
    if (text)
      out.push({ text, checked: false, ...(node.content ? { content: node.content } : {}) });
    return;
  }
  for (const child of node.content ?? []) collect(child, out);
}

/** The criteria a stored document holds, in order. */
export function criteriaOf(doc: RichText | null | undefined): Criterion[] {
  if (!doc) return [];
  const out: Criterion[] = [];
  collect(doc as Node, out);
  return out;
}

/** The criteria as the document to store: one task list, or null when there are none. */
export function criteriaDoc(items: readonly Criterion[]): RichText | null {
  const kept = items.filter((item) => item.text.trim());
  if (kept.length === 0) return null;
  return {
    type: 'doc',
    content: [
      {
        type: 'taskList',
        content: kept.map((item) => ({
          type: 'taskItem',
          attrs: { checked: item.checked },
          content: [
            {
              type: 'paragraph',
              content: item.content ?? [{ type: 'text', text: item.text.trim() }],
            },
          ],
        })),
      },
    ],
  } as RichText;
}
