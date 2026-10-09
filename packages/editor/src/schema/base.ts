import type { AnyExtension } from '@tiptap/core';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mention } from '@tiptap/extension-mention';
import { StarterKit } from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { ReferenceLinks, type ReferenceLinkOptions } from './references.ts';

/*
 * The base set: Work's descriptions and comments. Its own file, so Work's editor chunk loads
 * these extensions and none of the Docs nodes the full schema adds.
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
