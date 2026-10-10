import { editorSchema } from '@bemmoly/editor/schema';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findQuote } from './anchor.ts';
import { CommentHighlighter, type HighlightUpdate } from './highlights.ts';

const schema = editorSchema();
const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((view) => view.destroy()));

/** A view drawing the highlighter as the live editor does: a direct prop, mapped per transaction. */
function viewWith(text: string, onPick = vi.fn()) {
  const highlighter = new CommentHighlighter(onPick);
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const view: EditorView = new EditorView(document.createElement('div'), {
    state: EditorState.create({ schema, doc }),
    decorations: highlighter.decorations,
    handleClick: highlighter.handleClick,
    dispatchTransaction(tr) {
      highlighter.map(tr);
      view.updateState(view.state.apply(tr));
    },
  });
  views.push(view);
  const update = (change: HighlightUpdate) => {
    highlighter.update(view.state.doc, change);
    view.updateState(view.state);
  };
  return { view, onPick, update };
}

const marks = (view: EditorView) =>
  [...view.dom.querySelectorAll<HTMLElement>('[data-comment-id]')].map((el) => ({
    id: el.dataset['commentId'],
    text: el.textContent,
    active: el.className.includes('ring-1'),
  }));

describe('comment highlights', () => {
  it('draws each range with its thread id and the focused one stronger', () => {
    const { view, update } = viewWith(
      'Flip auth_pg_sessions off; sessions stay valid for 15 minutes.',
    );
    const ranges = [
      { id: 'a', ...findQuote(view.state.doc, 'auth_pg_sessions')! },
      { id: 'b', ...findQuote(view.state.doc, '15 minutes')! },
    ];
    update({ ranges, active: 'b' });
    expect(marks(view)).toEqual([
      { id: 'a', text: 'auth_pg_sessions', active: false },
      { id: 'b', text: '15 minutes', active: true },
    ]);
    update({ active: null });
    expect(marks(view).map((mark) => mark.active)).toEqual([false, false]);
  });

  it('keeps a highlight on its words while text is typed before them', () => {
    const { view, update } = viewWith('Keep Redis warm for 7 days.');
    update({ ranges: [{ id: 'a', ...findQuote(view.state.doc, 'warm')! }] });
    view.dispatch(view.state.tr.insertText('Please ', 1));
    expect(marks(view)).toEqual([{ id: 'a', text: 'warm', active: false }]);
  });

  it('never draws a range outside the document', () => {
    const { view, update } = viewWith('Short');
    update({ ranges: [{ id: 'x', from: 2, to: 400 }] });
    expect(marks(view)).toEqual([]);
  });

  it('names the thread under a click', () => {
    const { view, onPick, update } = viewWith('Rollback is a flag flip.');
    const range = findQuote(view.state.doc, 'flag flip')!;
    update({ ranges: [{ id: 't1', ...range }] });
    view.someProp('handleClick', (handler) =>
      handler(view, range.from + 2, new MouseEvent('click')),
    );
    expect(onPick).toHaveBeenCalledWith('t1');
  });
});
