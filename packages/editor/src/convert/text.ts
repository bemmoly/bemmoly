import { docNode } from '../schema/nodes/registry.ts';
import type { DocReference } from '../schema/nodes/types.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import { walk } from './walk.ts';

/*
 * What the server reads out of a page without an editor: the plain-text shadow that search,
 * previews and AI context use, its word count and the records it points at for the links
 * graph. The outline for the table of contents is in outline.ts. Each registered node says what text it holds
 * and what it points at; the base nodes are read here.
 */

/** Blocks end with a line break so two paragraphs never run into one word. */
const BLOCKS = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'taskItem',
  'tableRow',
  'horizontalRule',
  'image',
  'issueTable',
  'issueCard',
  'toc',
  'unsupportedBlock',
]);

/** A cell's blocks share its row's line. */
const CELLS = new Set(['tableCell', 'tableHeader']);

function append(node: RichTextNode, out: string[]): void {
  const registered = docNode(node.type)?.plainText;
  if (typeof node.text === 'string') out.push(node.text);
  else if (registered) out.push(registered(node));
  else if (node.type === 'hardBreak') out.push('\n');
  else if (CELLS.has(node.type)) {
    const cell: string[] = [];
    for (const child of node.content ?? []) append(child, cell);
    out.push(cell.join('').replace(/\s+/g, ' ').trim(), ' ');
  } else for (const child of node.content ?? []) append(child, out);
  if (BLOCKS.has(node.type)) out.push('\n');
}

/** The document as one string: one line per block, runs of spaces collapsed. */
export function plainText(doc: RichTextDoc | RichTextNode | null | undefined): string {
  if (!doc) return '';
  const out: string[] = [];
  append(doc as RichTextNode, out);
  // One pass per whitespace run, so a long run cannot backtrack.
  return out
    .join('')
    .replace(/\s+/g, (run) => (run.includes('\n') ? '\n' : ' '))
    .trim();
}

/** Words a reader would count: runs of letters, digits or symbols between spaces. */
export function wordCount(doc: RichTextDoc | RichTextNode | null | undefined): number {
  const text = plainText(doc);
  return text ? text.split(/\s+/u).length : 0;
}

const referenceKey = (ref: DocReference) =>
  ref.kind === 'issue'
    ? `issue:${ref.key}`
    : ref.kind === 'issueQuery'
      ? `q:${ref.query}`
      : `${ref.kind}:${ref.id}`;

/** Every page, person, issue and issue query the document points at, once, in order. */
export function collectReferences(doc: RichTextDoc | null | undefined): DocReference[] {
  if (!doc) return [];
  const seen = new Set<string>();
  const refs: DocReference[] = [];
  walk(doc as RichTextNode, (node) => {
    for (const ref of docNode(node.type)?.references?.(node) ?? []) {
      const key = referenceKey(ref);
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push(ref);
    }
  });
  return refs;
}

export { buildToc, headingIds, slugify, type TocEntry } from './outline.ts';
