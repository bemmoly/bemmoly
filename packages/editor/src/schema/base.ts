import type { AnyExtension } from '@tiptap/core';
import { Code } from '@tiptap/extension-code';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Mention } from '@tiptap/extension-mention';
import { StarterKit } from '@tiptap/starter-kit';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { Highlight } from './highlight.ts';
import { ReferenceLinks, type ReferenceLinkOptions } from './references.ts';

/*
 * The base set: Work's descriptions and comments, whose editor adds tables (editor/create.ts).
 * Its own file, so Work's editor chunk loads these extensions and none of the other Docs nodes
 * the full schema adds.
 */

export interface SchemaOptions {
  /** The @ search; without it @ is plain text, though stored mentions still load. */
  mention?: Omit<SuggestionOptions, 'editor'>;
  /** Links to records by key; see ReferenceLinks. */
  references?: Partial<ReferenceLinkOptions>;
  /**
   * False leaves out ProseMirror's undo history, for collaborative editing, where undo is
   * Yjs's and covers only the person's own changes.
   */
  history?: boolean;
}

export const HEADING_LEVELS = [1, 2, 3] as const;

/*
 * Tiptap's code mark excludes every other mark, so **`foo`** or _see `bar`_ fails the whole
 * document. Here it sits alongside bold, italic, strike, links and highlight.
 */
const InlineCode = Code.extend({ excludes: '' });

export function baseExtensions(options: SchemaOptions = {}): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [...HEADING_LEVELS] },
      underline: false,
      trailingNode: false,
      code: false,
      // The drop line of a dragged block: the accent, 2px, as the review draws it.
      dropcursor: { color: 'var(--acc)', width: 2, class: 'rounded-full' },
      ...(options.history === false ? { undoRedo: false as const } : {}),
      link: {
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: 'https',
        HTMLAttributes: { target: null },
      },
    }),
    InlineCode,
    Highlight,
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
