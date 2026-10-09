import type { RichTextDoc, RichTextNode } from './types.ts';

/** Nodes that are content on their own, with no text inside them. */
const SOLID = new Set(['mention', 'horizontalRule', 'image']);

function hasContent(node: RichTextNode): boolean {
  if (typeof node.text === 'string') return node.text.trim().length > 0;
  if (SOLID.has(node.type)) return true;
  return (node.content ?? []).some(hasContent);
}

/** True when a document holds nothing a reader would see: no text, mention or divider. */
export function isEmptyDoc(doc: RichTextDoc | null | undefined): boolean {
  return !doc || !(doc.content ?? []).some(hasContent);
}
