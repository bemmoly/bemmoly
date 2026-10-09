import { mergeAttributes, Node } from '@tiptap/core';
import type { DocNode } from './types.ts';

/*
 * A table of contents: a marker that prints the page's headings where it stands. It stores
 * only how deep to go; the headings are read from the document each time it is drawn or
 * exported, so it can never fall out of date.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    toc: {
      insertToc: () => ReturnType;
    };
  }
}

export const Toc = Node.create({
  name: 'toc',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      maxLevel: {
        default: 3,
        parseHTML: (element) => Number(element.getAttribute('data-max-level') ?? 3) || 3,
        renderHTML: (attributes) => ({ 'data-max-level': attributes['maxLevel'] }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'nav[data-type="toc"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['nav', mergeAttributes(HTMLAttributes, { 'data-type': 'toc' })];
  },

  addCommands() {
    return {
      insertToc:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

/** The exporters fill the contents in; see convert/, which knows the whole document. */
export const toc: DocNode = {
  name: 'toc',
  extensions: () => [Toc],
  plainText: () => '',
};
