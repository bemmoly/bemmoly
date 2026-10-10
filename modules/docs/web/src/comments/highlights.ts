import type { DocEditorProps } from '@bemmoly/editor';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { TextRange } from './anchor.ts';

/** The live page editor, as DocEditor's onEditor hands it over. */
export type PageEditor = NonNullable<Parameters<NonNullable<DocEditorProps['onEditor']>>[0]>;

/*
 * The doc's comment highlights: the mock's amber wash under every open inline thread, a
 * stronger one under the thread in focus. Decorations only, so the stored document never
 * changes; classes only, because the content security policy allows no style attributes.
 * The plugin is registered on the live editor, so the page screen passes nothing at creation.
 */

export interface HighlightRange extends TextRange {
  id: string;
}

interface HighlightState {
  ranges: readonly HighlightRange[];
  active: string | null;
  set: DecorationSet;
}

interface HighlightMeta {
  ranges?: readonly HighlightRange[];
  active?: string | null;
}

export const commentHighlightKey = new PluginKey<HighlightState>('docsCommentHighlights');

export const HIGHLIGHT_CLASS = 'rounded-xs bg-amber-bg motion-safe:transition-colors';
export const ACTIVE_CLASS =
  'rounded-xs bg-amber-bg shadow-[0_0_0_2px_var(--color-amber-bg)] ring-1 ring-amber-fg/30';

function decorate(state: EditorState, ranges: readonly HighlightRange[], active: string | null) {
  const size = state.doc.content.size;
  const decorations = ranges
    .filter((range) => range.from >= 0 && range.to <= size && range.from < range.to)
    .map((range) =>
      Decoration.inline(
        range.from,
        range.to,
        {
          class: range.id === active ? ACTIVE_CLASS : HIGHLIGHT_CLASS,
          'data-comment-id': range.id,
        },
        { id: range.id },
      ),
    );
  return DecorationSet.create(state.doc, decorations);
}

/** The highlight plugin; `onPick` hears a click on highlighted text with its thread id. */
export function commentHighlightPlugin(onPick: (id: string) => void): Plugin<HighlightState> {
  return new Plugin<HighlightState>({
    key: commentHighlightKey,
    state: {
      init: (_config, state) => ({ ranges: [], active: null, set: decorate(state, [], null) }),
      apply(tr: Transaction, previous, _old, state) {
        const meta = tr.getMeta(commentHighlightKey) as HighlightMeta | undefined;
        if (meta) {
          const ranges = meta.ranges ?? previous.ranges;
          const active = meta.active === undefined ? previous.active : meta.active;
          return { ranges, active, set: decorate(state, ranges, active) };
        }
        if (!tr.docChanged) return previous;
        return { ...previous, set: previous.set.map(tr.mapping, tr.doc) };
      },
    },
    props: {
      decorations: (state) => commentHighlightKey.getState(state)?.set ?? null,
      handleClick(view, pos) {
        const found = commentHighlightKey.getState(view.state)?.set.find(pos, pos);
        const id = found?.[0]?.spec?.['id'] as string | undefined;
        if (id) onPick(id);
        return false;
      },
    },
  });
}

/** Replaces the highlighted ranges and, when given, which thread is in focus. */
export function setHighlights(editor: PageEditor, meta: HighlightMeta): void {
  if (editor.isDestroyed || !commentHighlightKey.getState(editor.state)) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(commentHighlightKey, meta).setMeta('addToHistory', false),
  );
}

/** Installs the plugin once per editor; returns the uninstall. */
export function installHighlights(editor: PageEditor, onPick: (id: string) => void): () => void {
  if (editor.isDestroyed) return () => undefined;
  if (!commentHighlightKey.getState(editor.state)) {
    editor.registerPlugin(commentHighlightPlugin(onPick));
  }
  return () => {
    if (!editor.isDestroyed) editor.unregisterPlugin(commentHighlightKey);
  };
}

/** Scrolls the highlighted text into the middle of its scroller, calmly. */
export function scrollToRange(editor: PageEditor, range: TextRange): void {
  if (editor.isDestroyed) return;
  const dom = editor.view.domAtPos(range.from).node;
  const element = dom instanceof Element ? dom : dom.parentElement;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
}
