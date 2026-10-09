import { docNode } from '../schema/nodes/registry.ts';
import type { DocReference } from '../schema/nodes/types.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';
import { textOf, walk } from './walk.ts';

/*
 * What the server reads out of a page without an editor: the plain-text shadow that search,
 * previews and AI context use, its word count, the records it points at for the links graph,
 * and its outline for the table of contents. Each registered node says what text it holds
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

export interface TocEntry {
  level: number;
  text: string;
  /** The anchor the heading carries in the view and in exports. */
  id: string;
}

/** "Migration order" as "migration-order"; empty headings become "section". */
export function slugify(text: string): string {
  const slug = text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

/**
 * The page's headings down to `maxLevel`, top level only (not inside callouts or tables), each
 * with an anchor that is unique on the page: a repeated heading gets "-2", "-3".
 */
export function buildToc(doc: RichTextDoc | null | undefined, maxLevel = 3): TocEntry[] {
  const ids = headingIds(doc);
  return (doc?.content ?? [])
    .filter((node) => node.type === 'heading')
    .flatMap((node, index) => {
      const level = Number(node.attrs?.['level'] ?? 1);
      const text = textOf(node).trim();
      return level <= maxLevel && text ? [{ level, text, id: ids[index]! }] : [];
    });
}

/** The anchor of every top-level heading, in order; what the view and exports print. */
export function headingIds(doc: RichTextDoc | null | undefined): string[] {
  const used = new Map<string, number>();
  return (doc?.content ?? [])
    .filter((node) => node.type === 'heading')
    .map((node) => {
      const base = slugify(textOf(node).trim());
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      return count > 1 ? `${base}-${count}` : base;
    });
}
