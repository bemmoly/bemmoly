import type { RichText } from '@bemmoly/module-work/shared';

/*
 * The editor package's Tiptap editor is not in this chunk yet, so descriptions and comments
 * are edited as text. Paragraphs are separated by a blank line, "- " starts a bullet, "1. " a
 * numbered item and "[ ] " or "[x] " a checklist item; other nodes survive as their text.
 */

export interface PmNode {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: PmNode[];
}

const BULLET = /^[-*]\s+/;
const TASK = /^\[( |x|X)\]\s+/;
const ORDERED = /^\d+\.\s+/;

function inlineText(node: PmNode): string {
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'mention') return `@${String(node.attrs?.['label'] ?? '')}`;
  return (node.content ?? []).map(inlineText).join('');
}

function blockText(node: PmNode): string {
  switch (node.type) {
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? [])
        .map(
          (item, index) =>
            `${node.type === 'orderedList' ? `${index + 1}.` : '-'} ${inlineText(item).trim()}`,
        )
        .join('\n');
    case 'taskList':
      return (node.content ?? [])
        .map((item) => `[${item.attrs?.['checked'] ? 'x' : ' '}] ${inlineText(item).trim()}`)
        .join('\n');
    default:
      return inlineText(node);
  }
}

/** The document as editable text; an empty string for no document. */
export function docToText(doc: RichText | null | undefined): string {
  const blocks = ((doc as PmNode | null | undefined)?.content ?? []).map(blockText);
  return blocks.filter((block) => block.trim()).join('\n\n');
}

const paragraph = (text: string): PmNode => ({
  type: 'paragraph',
  content: text ? [{ type: 'text', text }] : [],
});

function listOf(lines: string[]): PmNode {
  if (lines.every((line) => TASK.test(line))) {
    return {
      type: 'taskList',
      content: lines.map((line) => ({
        type: 'taskItem',
        attrs: { checked: /^\[[xX]\]/.test(line) },
        content: [paragraph(line.replace(TASK, ''))],
      })),
    };
  }
  const ordered = lines.every((line) => ORDERED.test(line));
  return {
    type: ordered ? 'orderedList' : 'bulletList',
    content: lines.map((line) => ({
      type: 'listItem',
      content: [paragraph(line.replace(ordered ? ORDERED : BULLET, ''))],
    })),
  };
}

/** Text back into a document; null when nothing but whitespace was written. */
export function textToDoc(text: string): RichText | null {
  const blocks = text
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (!blocks.length) return null;
  const content = blocks.map((block) => {
    const lines = block.split('\n').map((line) => line.trim());
    const listed = (line: string) => BULLET.test(line) || TASK.test(line) || ORDERED.test(line);
    if (lines.every(listed)) return listOf(lines);
    return {
      type: 'paragraph',
      content: lines.flatMap((line, index) => [
        ...(index > 0 ? [{ type: 'hardBreak' }] : []),
        ...(line ? [{ type: 'text', text: line }] : []),
      ]),
    };
  });
  return { type: 'doc', content } as RichText;
}

/** True when a document holds no visible text. */
export function isEmptyDoc(doc: RichText | null | undefined): boolean {
  return !docToText(doc).trim();
}
