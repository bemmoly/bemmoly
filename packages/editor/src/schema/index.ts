import { getSchema, type AnyExtension } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mention } from '@tiptap/extension-mention';
import type { Schema } from '@tiptap/pm/model';
import { StarterKit } from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { ReferenceLinks, type ReferenceLinkOptions } from './references.ts';

/*
 * The one document schema: Work's descriptions and comments and, from the Docs module, pages.
 * Node and mark names are Tiptap's defaults, which is what the stored JSON and the server's
 * plain-text shadow already assume. It has no React in it, so the server can load it to read
 * documents. Module nodes join through the editor registry; the base set is here.
 */

export interface SchemaOptions {
  /** The @ search; without it @ is plain text, though stored mentions still load. */
  mention?: Omit<SuggestionOptions, 'editor'>;
  /** Links to records by key; see ReferenceLinks. */
  references?: Partial<ReferenceLinkOptions>;
}

export const HEADING_LEVELS = [1, 2, 3] as const;

export function baseExtensions(options: SchemaOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      underline: false,
      trailingNode: false,
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: { target: null },
      },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: { checkboxLabel: (_node, checked) => (checked ? 'Done' : 'Not done') },
    }),
    Mention.configure({
      deleteTriggerWithBackspace: true,
      suggestion: options.mention ?? { allow: () => false },
    }),
    ReferenceLinks.configure(options.references ?? {}),
  ];
}

/** The ProseMirror schema of the base set, for reading stored documents outside an editor. */
export function editorSchema(): Schema {
  return getSchema(baseExtensions());
}

export { ReferenceLinks, referencePluginKey, type ReferenceLinkOptions } from './references.ts';
