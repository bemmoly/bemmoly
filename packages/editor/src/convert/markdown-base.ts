import type { RichTextDoc, RichTextNode } from '../types.ts';
import { fromMarkdown } from './from-markdown.ts';

/*
 * Markdown for Work's descriptions and comments. Their editor holds the base set
 * (schema/base.ts) and tables, and ProseMirror drops a whole document over one node it does
 * not know, so the other Docs nodes the parser makes are folded into ones it holds: a callout
 * or decision into a quote, an image into its link.
 */

const BASE_NODES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'hardBreak',
  'text',
  'mention',
  'table',
  'tableRow',
  'tableHeader',
  'tableCell',
]);
const BASE_MARKS = new Set(['bold', 'italic', 'strike', 'code', 'link', 'highlight']);

const NONE: Keep = new Set();

const paragraph = (content: RichTextNode[]): RichTextNode =>
  content.length ? { type: 'paragraph', content } : { type: 'paragraph' };

/** A block's inline content, its blocks' lines joined by a space. */
function inlineOf(node: RichTextNode): RichTextNode[] {
  if (node.type === 'text' || node.type === 'mention' || node.type === 'hardBreak') {
    return [fitNode(node, NONE)];
  }
  const parts = (node.content ?? []).map(inlineOf).filter((part) => part.length);
  return parts.flatMap((part, index) => (index ? [{ type: 'text', text: ' ' }, ...part] : part));
}

/** Block types a caller's editor also holds, left as they are (Docs keeps images). */
type Keep = ReadonlySet<string>;

function fitNode(node: RichTextNode, keep: Keep): RichTextNode {
  const marks = node.marks?.filter((mark) => BASE_MARKS.has(mark.type));
  const fitted: RichTextNode = { ...node };
  if (marks) {
    if (marks.length) fitted.marks = marks;
    else delete fitted.marks;
  }
  if (node.type === 'heading') {
    fitted.attrs = { ...node.attrs, level: Math.min(Number(node.attrs?.['level'] ?? 2), 3) };
  }
  if (node.content) fitted.content = fitBlocks(node.content, keep);
  return fitted;
}

function fitBlocks(nodes: RichTextNode[], keep: Keep): RichTextNode[] {
  return nodes.flatMap((node): RichTextNode[] => {
    if (BASE_NODES.has(node.type)) return [fitNode(node, keep)];
    if (keep.has(node.type)) return [node];
    if (node.type === 'callout' || node.type === 'decision') {
      return [{ type: 'blockquote', content: fitBlocks(node.content ?? [], keep) }];
    }
    if (node.type === 'image') {
      const src = String(node.attrs?.['src'] ?? '');
      const alt = String(node.attrs?.['alt'] ?? '') || src;
      return src
        ? [
            paragraph([
              { type: 'text', text: alt, marks: [{ type: 'link', attrs: { href: src } }] },
            ]),
          ]
        : [];
    }
    return [paragraph(inlineOf(node))];
  });
}

export interface FitOptions {
  /** Block types the target editor also holds, kept instead of folded. */
  keep?: readonly string[];
}

/** A document in any schema, folded into the nodes Work's editor reads. */
export function fitBase(doc: RichTextDoc, options: FitOptions = {}): RichTextDoc {
  return { type: 'doc', content: fitBlocks(doc.content ?? [], new Set(options.keep)) };
}

/** Markdown as a document Work's description and comment editor can open. */
export function fromMarkdownBase(markdown: string, options: FitOptions = {}): RichTextDoc {
  return fitBase(fromMarkdown(markdown), options);
}
