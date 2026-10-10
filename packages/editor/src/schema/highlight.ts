import { Mark, markInputRule, markPasteRule, mergeAttributes } from '@tiptap/core';

/*
 * A highlighted run of text: one tint, no colour choice, so a reader sees emphasis rather than
 * a palette. It is a new mark beside the base set's, so documents written before it load as
 * they were, and a document that uses it reads in any client that knows the mark.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    highlight: {
      toggleHighlight: () => ReturnType;
    };
  }
}

/** ==text== while typing or pasting, as several Markdown dialects write it. */
const INPUT = /(?:^|\s)(==(?!\s+==)((?:[^=]+))==(?!\s+==))$/;
const PASTE = /(?:^|\s)(==(?!\s+==)((?:[^=]+))==(?!\s+==))/g;

export const Highlight = Mark.create({
  name: 'highlight',

  parseHTML() {
    return [{ tag: 'mark' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      toggleHighlight:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },

  addKeyboardShortcuts() {
    return { 'Mod-Shift-h': () => this.editor.commands.toggleHighlight() };
  },

  addInputRules() {
    return [markInputRule({ find: INPUT, type: this.type })];
  },

  addPasteRules() {
    return [markPasteRule({ find: PASTE, type: this.type })];
  },
});
