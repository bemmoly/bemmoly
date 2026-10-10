import type { DocEditorProps } from '@bemmoly/editor';
import type { Node as PmNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorProps, type EditorView } from '@tiptap/pm/view';
import type { TextRange } from './anchor.ts';

/** The live page editor, as DocEditor's onEditor hands it over. */
export type PageEditor = NonNullable<Parameters<NonNullable<DocEditorProps['onEditor']>>[0]>;

/*
 * The doc's comment highlights: the mock's amber wash under every open inline thread, a
 * stronger one under the thread in focus. Decorations only, so the stored document never
 * changes; classes only, because the content security policy allows no style attributes.
 *
 * They are a direct prop of the live editor, not a plugin: adding a plugin to a running
 * editor reconfigures every plugin, and the collaboration binding does not survive that.
 * The set is mapped through each transaction before the view draws it.
 */

export interface HighlightRange extends TextRange {
  id: string;
}

export interface HighlightUpdate {
  ranges?: readonly HighlightRange[];
  active?: string | null;
}

export const HIGHLIGHT_CLASS = 'rounded-chip bg-amber-bg motion-safe:transition-colors';
export const ACTIVE_CLASS =
  'rounded-chip bg-amber-bg shadow-[0_0_0_2px_var(--color-amber-bg)] ring-1 ring-amber-fg/30';

/** The highlighted ranges of one editor and the decorations drawn for them. */
export class CommentHighlighter {
  private ranges: readonly HighlightRange[] = [];
  private active: string | null = null;
  private set = DecorationSet.empty;

  private readonly onPick: (id: string) => void;

  constructor(onPick: (id: string) => void) {
    this.onPick = onPick;
  }

  /** The editor prop: what the view draws now. */
  readonly decorations = (): DecorationSet => this.set;

  /** Keeps the drawn ranges on their text while the document changes. */
  map(tr: Transaction): void {
    if (tr.docChanged) this.set = this.set.map(tr.mapping, tr.doc);
  }

  /** New ranges or a new focused thread, drawn over `doc`. */
  update(doc: PmNode, change: HighlightUpdate): void {
    if (change.ranges) this.ranges = change.ranges;
    if (change.active !== undefined) this.active = change.active;
    const size = doc.content.size;
    this.set = DecorationSet.create(
      doc,
      this.ranges
        .filter((range) => range.from >= 0 && range.to <= size && range.from < range.to)
        .map((range) =>
          Decoration.inline(
            range.from,
            range.to,
            {
              class: range.id === this.active ? ACTIVE_CLASS : HIGHLIGHT_CLASS,
              'data-comment-id': range.id,
            },
            { id: range.id },
          ),
        ),
    );
  }

  /** The thread under a click, if any; never takes the click from the editor. */
  readonly handleClick = (_view: EditorView, pos: number): boolean => {
    const id = this.set.find(pos, pos)[0]?.spec?.['id'] as string | undefined;
    if (id) this.onPick(id);
    return false;
  };
}

const highlighters = new WeakMap<PageEditor, CommentHighlighter>();

/** Draws `highlighter` in the live editor until the returned uninstall runs. */
export function installHighlights(editor: PageEditor, onPick: (id: string) => void): () => void {
  if (editor.isDestroyed) return () => undefined;
  const highlighter = new CommentHighlighter(onPick);
  const before = editor.options.editorProps as EditorProps;
  const mine: EditorProps = {
    ...before,
    decorations: highlighter.decorations,
    handleClick: (view, pos, event) =>
      Boolean(before.handleClick?.(view, pos, event)) || highlighter.handleClick(view, pos),
  };
  const onTransaction = ({ transaction }: { transaction: Transaction }) =>
    highlighter.map(transaction);
  highlighters.set(editor, highlighter);
  editor.on('beforeTransaction', onTransaction);
  editor.setOptions({ editorProps: mine });
  return () => {
    highlighters.delete(editor);
    editor.off('beforeTransaction', onTransaction);
    if (!editor.isDestroyed) editor.setOptions({ editorProps: before });
  };
}

/** Replaces the highlighted ranges and, when given, which thread is in focus; redraws. */
export function setHighlights(editor: PageEditor, change: HighlightUpdate): void {
  const highlighter = highlighters.get(editor);
  if (!highlighter || editor.isDestroyed) return;
  highlighter.update(editor.state.doc, change);
  editor.view.updateState(editor.view.state);
}

/** Scrolls the highlighted text into the middle of its scroller, calmly. */
export function scrollToRange(editor: PageEditor, range: TextRange): void {
  if (editor.isDestroyed) return;
  const dom = editor.view.domAtPos(range.from).node;
  const element = dom instanceof Element ? dom : dom.parentElement;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
}
