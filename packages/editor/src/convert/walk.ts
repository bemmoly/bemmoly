import type { RichTextNode } from '../types.ts';

/** Visits a node and every node under it, depth first, in document order. */
export function walk(node: RichTextNode, visit: (node: RichTextNode) => void): void {
  visit(node);
  for (const child of node.content ?? []) walk(child, visit);
}

/** The text directly under a node, ignoring marks and inline atoms. */
export function textOf(node: RichTextNode): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textOf).join('');
}
