import { getSchema, type AnyExtension } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { baseExtensions, type SchemaOptions } from './base.ts';
import { docNodeExtensions } from './nodes/registry.ts';

/*
 * The one document schema: Work's descriptions and comments and, from the Docs module, pages.
 * Node and mark names are Tiptap's defaults, which is what the stored JSON and the server's
 * plain-text shadow already assume. It has no React in it, so the server can load it to read
 * documents. The base set (base.ts) is Work's; Docs pages add the registered nodes (nodes/registry.ts)
 * on top, and one schema reads both, since a superset reads every document the base wrote.
 */

/** The base set and every registered node: what a Docs page is written in. */
export function docExtensions(options: SchemaOptions = {}): AnyExtension[] {
  return [...baseExtensions(options), ...docNodeExtensions()];
}

let schema: Schema | null = null;

/** The one ProseMirror schema, for reading any stored document outside an editor. */
export function editorSchema(): Schema {
  schema ??= getSchema(docExtensions());
  return schema;
}

export { baseExtensions, HEADING_LEVELS, type SchemaOptions } from './base.ts';
export { ReferenceLinks, referencePluginKey, type ReferenceLinkOptions } from './references.ts';
export { CALLOUT_LABELS, CALLOUT_VARIANTS, type CalloutVariant } from './nodes/callout.ts';
export { CODE_LANGUAGES, codeLanguage, type CodeLanguage } from './nodes/code-block.ts';
export {
  DECISION_LABELS,
  DECISION_STATES,
  decisionHeading,
  type DecisionState,
} from './nodes/decision.ts';
export { SAFE_IMAGE_SRC } from './nodes/image.ts';
export { DOC_NODES, docNode, docNodeExtensions } from './nodes/registry.ts';
export type { DocNode, DocReference, ExportContext } from './nodes/types.ts';
export { unsupportedLabel } from './nodes/unsupported-block.ts';
