import { editorSchema } from '@bemmoly/editor/schema';
import { EditorState } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findQuote } from './anchor.ts';
import { commentHighlightKey, commentHighlightPlugin } from './highlights.ts';

const schema = editorSchema();
const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((view) => view.destroy()));

function viewWith(text: string, onPick = vi.fn()) {
  const doc = schema.nodeFromJSON({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });
  const state = EditorState.create({ schema, doc, plugins: [commentHighlightPlugin(onPick)] });
  const view = new EditorView(document.createElement('div'), { state });
  views.push(view);
  return { view, onPick };
}

const marks = (view: EditorView) =>
  [...view.dom.querySelectorAll<HTMLElement>('[data-comment-id]')].map((el) => ({
    id: el.dataset['commentId'],
    text: el.textContent,
    active: el.className.includes('ring-1'),
  }));

describe('comment highlights', () => {
  it('draws each range with its thread id and the focused one stronger', () => {
    const { view } = viewWith('Flip auth_pg_sessions off; sessions stay valid for 15 minutes.');
    const ranges = [
      { id: 'a', ...findQuote(view.state.doc, 'auth_pg_sessions')! },
      { id: 'b', ...findQuote(view.state.doc, '15 minutes')! },
    ];
    view.dispatch(view.state.tr.setMeta(commentHighlightKey, { ranges, active: 'b' }));
    expect(marks(view)).toEqual([
      { id: 'a', text: 'auth_pg_sessions', active: false },
      { id: 'b', text: '15 minutes', active: true },
    ]);
  });

  it('keeps a highlight on its words while text is typed before them', () => {
    const { view } = viewWith('Keep Redis warm for 7 days.');
    const range = findQuote(view.state.doc, 'warm')!;
    view.dispatch(view.state.tr.setMeta(commentHighlightKey, { ranges: [{ id: 'a', ...range }] }));
    view.dispatch(view.state.tr.insertText('Please ', 1));
    expect(marks(view)).toEqual([{ id: 'a', text: 'warm', active: false }]);
  });

  it('never draws a range outside the document', () => {
    const { view } = viewWith('Short');
    view.dispatch(
      view.state.tr.setMeta(commentHighlightKey, { ranges: [{ id: 'x', from: 2, to: 400 }] }),
    );
    expect(marks(view)).toEqual([]);
  });

  it('names the thread under a click', () => {
    const { view, onPick } = viewWith('Rollback is a flag flip.');
    const range = findQuote(view.state.doc, 'flag flip')!;
    view.dispatch(view.state.tr.setMeta(commentHighlightKey, { ranges: [{ id: 't1', ...range }] }));
    view.someProp('handleClick', (handler) =>
      handler(view, range.from + 2, new MouseEvent('click')),
    );
    expect(onPick).toHaveBeenCalledWith('t1');
  });
});
