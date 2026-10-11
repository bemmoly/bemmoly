import { Extension, InputRule, PasteRule } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';
import { PluginKey } from '@tiptap/pm/state';
import { Suggestion, type SuggestionOptions } from '@tiptap/suggestion';

/*
 * Links to records by key. A key is stored as its own text under a link mark, so the
 * plain-text shadow reads "PLT-204" and search finds it, and no node type is needed: the
 * schema stays the one the Docs editor registers. Three ways in: `#` and a search, typing a
 * key followed by a space or punctuation, and pasting text that holds keys.
 */

export interface ReferenceLinkOptions {
  /** A whole key, anchored or not; its source is reused inside the rules. */
  pattern: RegExp | null;
  hrefFor: (key: string) => string;
  /** The `#` search; absent where only typed and pasted keys link. */
  suggestion: Omit<SuggestionOptions, 'editor'> | null;
}

export const referencePluginKey = new PluginKey('reference');

const bare = (pattern: RegExp) => pattern.source.replace(/^\^/, '').replace(/\$$/, '');

/** True where a link may not go: inside code, or over text that is already a link. */
function blocked(state: EditorState, from: number, to: number): boolean {
  const link = state.schema.marks['link'];
  const $from = state.doc.resolve(from);
  if (!link || $from.parent.type.spec.code) return true;
  if (state.doc.rangeHasMark(from, to, link)) return true;
  const code = state.schema.marks['code'];
  return Boolean(code && state.doc.rangeHasMark(from, to, code));
}

export const ReferenceLinks = Extension.create<ReferenceLinkOptions>({
  name: 'referenceLinks',

  addOptions() {
    return { pattern: null, hrefFor: (key) => key, suggestion: null };
  },

  addInputRules() {
    const { pattern, hrefFor } = this.options;
    if (!pattern) return [];
    return [
      new InputRule({
        find: new RegExp(`(?:^|[\\s(])(${bare(pattern)})([\\s.,;:!?)])$`),
        handler: ({ state, range, match }) => {
          const key = match[1] ?? '';
          const typed = match[2] ?? ' ';
          const from = range.to - key.length;
          if (blocked(state, from, range.to)) return null;
          const link = state.schema.marks['link']!;
          state.tr.addMark(from, range.to, link.create({ href: hrefFor(key) }));
          state.tr.insert(range.to, state.schema.text(typed));
          return undefined;
        },
      }),
    ];
  },

  addPasteRules() {
    const { pattern, hrefFor } = this.options;
    if (!pattern) return [];
    return [
      new PasteRule({
        find: new RegExp(`(?<![\\w-])${bare(pattern)}(?![\\w-])`, 'g'),
        handler: ({ state, range, match }) => {
          if (blocked(state, range.from, range.to)) return null;
          const link = state.schema.marks['link']!;
          state.tr.addMark(range.from, range.to, link.create({ href: hrefFor(match[0]) }));
          return undefined;
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    const { suggestion } = this.options;
    if (!suggestion) return [];
    return [
      Suggestion({
        char: '#',
        allowedPrefixes: [' ', '('],
        pluginKey: referencePluginKey,
        ...suggestion,
        editor: this.editor,
      }),
    ];
  },
});
