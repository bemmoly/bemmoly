import { FILE_TYPES } from '../schema/nodes/file.ts';
import type { RichTextDoc, RichTextNode } from '../types.ts';

/*
 * Markdown has one way to put a file in a page: image syntax. A writer (an agent, an import)
 * uses it for a stored PDF or HTML file too, and only the host knows which a URL is. These
 * two steps let it answer: list the image sources, then turn the ones it found to be
 * documents into File blocks, keeping their place in the page.
 */

export interface StoredDocument {
  name: string;
  mime: string;
}

function walk(nodes: readonly RichTextNode[] | undefined, visit: (node: RichTextNode) => void) {
  for (const node of nodes ?? []) {
    visit(node);
    walk(node.content, visit);
  }
}

/** Every image source in the document, once each. */
export function imageSources(doc: RichTextDoc): string[] {
  const sources = new Set<string>();
  walk(doc.content, (node) => {
    const src = node.attrs?.['src'];
    if (node.type === 'image' && typeof src === 'string' && src) sources.add(src);
  });
  return [...sources];
}

function promote(node: RichTextNode, documents: ReadonlyMap<string, StoredDocument>): RichTextNode {
  const src = node.attrs?.['src'];
  const found = node.type === 'image' && typeof src === 'string' ? documents.get(src) : undefined;
  if (found && (FILE_TYPES as readonly string[]).includes(found.mime)) {
    const alt = node.attrs?.['alt'];
    const name = typeof alt === 'string' && alt.trim() ? alt.trim() : found.name;
    return { type: 'file', attrs: { src, name, mime: found.mime } };
  }
  return node.content
    ? { ...node, content: node.content.map((child) => promote(child, documents)) }
    : node;
}

/** The document with each image that is a stored PDF or HTML file made a File block. */
export function asFileBlocks(
  doc: RichTextDoc,
  documents: ReadonlyMap<string, StoredDocument>,
): RichTextDoc {
  if (documents.size === 0) return doc;
  return { ...doc, content: (doc.content ?? []).map((node) => promote(node, documents)) };
}
