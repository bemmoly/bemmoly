import type { AnyExtension } from '@tiptap/core';
import type { RichTextNode } from '../../types.ts';

/*
 * An editor node is a pluggable capability: one file per node exports a DocNode, and one
 * line in the registry adds it. A DocNode is everything about the node that runs without a
 * browser (its schema, the text it holds, the records it points at, and how it reads in
 * Markdown and HTML), so the server can load the same set to extract, index and export.
 * How a node looks while editing lives beside the editor, never here.
 */

/** A record a document points at, for the links graph and backlinks. */
export type DocReference =
  | { kind: 'page'; id: string }
  | { kind: 'user'; id: string }
  | { kind: 'issue'; key: string }
  | { kind: 'issueQuery'; query: string };

/** What a node's exporters can call back into: the rest of the document's printing. */
export interface ExportContext {
  /** The node's children printed as blocks. */
  blocks: (nodes: readonly RichTextNode[] | undefined) => string;
  /** The node's children printed as inline content. */
  inline: (nodes: readonly RichTextNode[] | undefined) => string;
  /** HTML-escapes text; Markdown exporters get the identity. */
  escape: (text: string) => string;
  /** Where a page link points, when the host knows; null prints the title alone. */
  pageHref: (pageId: string) => string | null;
  /** Where an issue key points, when the host knows. */
  issueHref: (key: string) => string | null;
}

export interface DocNode {
  /** The node type's name, as stored in the JSON. */
  name: string;
  /** The schema-only Tiptap extensions the node needs (a table needs four). */
  extensions: () => AnyExtension[];
  /** The text a reader would see, for search, previews and word counts. */
  plainText?: (node: RichTextNode) => string;
  /** The records the node points at. */
  references?: (node: RichTextNode) => DocReference[];
  toMarkdown?: (node: RichTextNode, context: ExportContext) => string;
  toHtml?: (node: RichTextNode, context: ExportContext) => string;
}

/** Reads a string attribute, or the fallback when it is missing or not a string. */
export function attr(node: RichTextNode, name: string, fallback = ''): string {
  const value = node.attrs?.[name];
  return typeof value === 'string' ? value : fallback;
}
