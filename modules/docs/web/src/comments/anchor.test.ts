import { editorSchema } from '@bemmoly/editor/schema';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { initProseMirrorDoc, prosemirrorJSONToYXmlFragment, ySyncPlugin } from '@tiptap/y-tiptap';
import { afterEach, describe, expect, it } from 'vitest';
import { Doc, XmlElement, XmlText } from 'yjs';
import { captureAnchor, findQuote, locateAnchor, resolvePositions } from './anchor.ts';

const schema = editorSchema();
const para = (value: string) => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
const page = (...blocks: unknown[]) => ({ type: 'doc', content: blocks });

const views: EditorView[] = [];
afterEach(() => views.splice(0).forEach((view) => view.destroy()));

/** A shared editor as the page has it: a Yjs fragment bound to a ProseMirror view. */
function sharedEditor(json: unknown) {
  const ydoc = new Doc();
  const fragment = ydoc.getXmlFragment('default');
  prosemirrorJSONToYXmlFragment(schema, json, fragment);
  const { doc, meta } = initProseMirrorDoc(fragment, schema);
  const state = EditorState.create({
    schema,
    doc,
    plugins: [ySyncPlugin(fragment, { mapping: meta.mapping })],
  });
  const view = new EditorView(document.createElement('div'), { state });
  views.push(view);
  return { ydoc, fragment, view };
}

/** Selects the first occurrence of `text` in the view. */
function select(view: EditorView, text: string) {
  const range = findQuote(view.state.doc, text);
  if (!range) throw new Error(`"${text}" is not on the page`);
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, range.from, range.to)),
  );
}

describe('anchor capture', () => {
  it('captures base64 relative positions and the quote of the selection', () => {
    const { view } = sharedEditor(page(para('Sessions stay valid for 15 minutes.')));
    select(view, '15 minutes');
    const result = captureAnchor(view.state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.anchor.quote).toBe('15 minutes');
    expect(result.anchor.from).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(resolvePositions(view.state, result.anchor)).toEqual(
      findQuote(view.state.doc, '15 minutes'),
    );
  });

  it('joins blocks with a newline in the quote', () => {
    const { view } = sharedEditor(page(para('First line'), para('Second line')));
    const from = findQuote(view.state.doc, 'line')!.from;
    const to = findQuote(view.state.doc, 'Second')!.to;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    const result = captureAnchor(view.state);
    expect(result.ok && result.anchor.quote).toBe('line\nSecond');
  });

  it('refuses an empty selection and an editor that is not shared', () => {
    const { view } = sharedEditor(page(para('Nothing selected')));
    expect(captureAnchor(view.state)).toEqual({ ok: false, reason: 'empty' });
    const plain = EditorState.create({ schema, doc: schema.nodeFromJSON(page(para('Plain'))) });
    const selected = plain.apply(plain.tr.setSelection(TextSelection.create(plain.doc, 1, 4)));
    expect(captureAnchor(selected)).toEqual({ ok: false, reason: 'not-shared' });
  });
});

describe('anchor resolution', () => {
  it('follows the text through edits before it, local and remote', () => {
    const { view, fragment } = sharedEditor(page(para('Rollback means a flag flip.')));
    select(view, 'flag flip');
    const result = captureAnchor(view.state);
    if (!result.ok) throw new Error('no anchor');
    view.dispatch(view.state.tr.insertText('Fast: ', 1));
    const intro = new XmlElement('paragraph');
    intro.insert(0, [new XmlText('A paragraph someone else added')]);
    fragment.insert(0, [intro]);
    const range = locateAnchor(view.state, result.anchor);
    expect(range && view.state.doc.textBetween(range.from, range.to)).toBe('flag flip');
  });

  it('is lost when the quoted words change', () => {
    const { view } = sharedEditor(page(para('Sessions stay valid for 15 minutes.')));
    select(view, '15 minutes');
    const result = captureAnchor(view.state);
    if (!result.ok) throw new Error('no anchor');
    const range = findQuote(view.state.doc, '15')!;
    view.dispatch(view.state.tr.insertText('30', range.from, range.to));
    expect(locateAnchor(view.state, result.anchor)).toBeNull();
  });

  it('falls back to the quote when the positions name another document', () => {
    const { view } = sharedEditor(page(para('Keep Redis warm for 7 days.')));
    const anchor = { from: 'AAAA', to: 'AAAA', quote: 'warm for\n7 days' };
    const range = locateAnchor(view.state, anchor);
    expect(range && view.state.doc.textBetween(range.from, range.to)).toBe('warm for 7 days');
  });
});

describe('quote search', () => {
  it('reads blocks as lines and whitespace loosely', () => {
    const doc = schema.nodeFromJSON(page(para('One  two'), para('three four')));
    const range = findQuote(doc, 'two\nthree');
    expect(range && doc.textBetween(range.from, range.to, '\n')).toBe('two\nthree');
    expect(findQuote(doc, 'missing words')).toBeNull();
    expect(findQuote(doc, '   ')).toBeNull();
  });
});
