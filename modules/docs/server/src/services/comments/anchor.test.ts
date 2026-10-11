import { describe, expect, it } from 'vitest';
import {
  createRelativePositionFromTypeIndex,
  Doc,
  encodeRelativePosition,
  XmlElement,
  XmlText,
} from 'yjs';
import type { RichText } from '../../../../shared/common.ts';
import type { CommentAnchor } from '../../../../shared/comments.ts';
import { docToSnapshot, PAGE_FIELD, writeSnapshot } from '../collab/convert.ts';
import { anchoredRange, createAnchorReader } from './anchor.ts';
import { applyReplacement } from './suggestion.ts';

const page = (...blocks: unknown[]) => ({ type: 'doc', content: blocks }) as RichText;
const para = (...content: unknown[]) => ({ type: 'paragraph', content });
const text = (value: string, marks?: unknown[]) => ({
  type: 'text',
  text: value,
  ...(marks ? { marks } : {}),
});

function setUp(snapshot: RichText): Doc {
  const doc = new Doc();
  writeSnapshot(doc, snapshot);
  return doc;
}

/** The XmlText of the n-th block's first text run. */
const runOf = (doc: Doc, block: number, child = 0) =>
  (doc.getXmlFragment(PAGE_FIELD).get(block) as XmlElement).get(child) as XmlText;

/** A run's characters without the formatting tags toString() adds. */
const plainOf = (run: XmlText) =>
  (run.toDelta() as { insert: string }[]).map((op) => op.insert).join('');

const position = (type: XmlText, index: number) =>
  Buffer.from(encodeRelativePosition(createRelativePositionFromTypeIndex(type, index))).toString(
    'base64',
  );

/** An anchor over `quote` inside one run, as the editor would send it. */
function anchorOver(doc: Doc, block: number, quote: string): CommentAnchor {
  const run = runOf(doc, block);
  const start = plainOf(run).indexOf(quote);
  return { from: position(run, start), to: position(run, start + quote.length), quote };
}

describe('comment anchors', () => {
  it('stays anchored while the text around it changes', () => {
    const doc = setUp(page(para(text('Ship the importer on Monday.'))));
    const anchor = anchorOver(doc, 0, 'importer');
    expect(createAnchorReader(doc).status(anchor)).toBe('anchored');
    runOf(doc, 0).insert(0, 'Please ');
    runOf(doc, 0).insert(runOf(doc, 0).length, ' Thanks.');
    const blocks = doc.getXmlFragment(PAGE_FIELD);
    const intro = new XmlElement('paragraph');
    intro.insert(0, [new XmlText('A new first paragraph')]);
    blocks.insert(0, [intro]);
    const reader = createAnchorReader(doc);
    expect(reader.status(anchor)).toBe('anchored');
    expect(reader.currentText(anchor)).toBe('importer');
  });

  it('reads as text changed when the quoted words are edited', () => {
    const doc = setUp(page(para(text('Ship the importer on Monday.'))));
    const anchor = anchorOver(doc, 0, 'importer on Monday');
    runOf(doc, 0).delete(runOf(doc, 0).toString().indexOf('Monday'), 6);
    runOf(doc, 0).insert(runOf(doc, 0).toString().indexOf('.'), 'Friday');
    expect(createAnchorReader(doc).status(anchor)).toBe('text_changed');
  });

  it('reads as text changed when the paragraph is deleted', () => {
    const doc = setUp(page(para(text('Keep me')), para(text('Delete this line'))));
    const anchor = anchorOver(doc, 1, 'this line');
    doc.getXmlFragment(PAGE_FIELD).delete(1, 1);
    expect(createAnchorReader(doc).status(anchor)).toBe('text_changed');
  });

  it('treats an unreadable anchor as lost', () => {
    const doc = setUp(page(para(text('Anything'))));
    const garbage = { from: 'bm90IGEgcG9zaXRpb24=', to: 'AAAA', quote: 'Anything' };
    expect(createAnchorReader(doc).status(garbage)).toBe('text_changed');
  });

  it('follows an anchor across two paragraphs', () => {
    const doc = setUp(page(para(text('First half')), para(text('second half'))));
    const anchor: CommentAnchor = {
      from: position(runOf(doc, 0), 6),
      to: position(runOf(doc, 1), 6),
      quote: 'half\nsecond',
    };
    expect(createAnchorReader(doc).status(anchor)).toBe('anchored');
    expect(anchoredRange(doc, anchor)).toBeNull();
  });
});

describe('applying a suggested fix', () => {
  it('replaces the anchored words and keeps their marks', () => {
    const doc = setUp(
      page(para(text('Rotate the '), text('api keys', [{ type: 'bold' }]), text(' yearly.'))),
    );
    const run = runOf(doc, 0);
    const start = plainOf(run).indexOf('api keys');
    const anchor = { from: position(run, start), to: position(run, start + 8), quote: 'api keys' };
    expect(applyReplacement(doc, anchor, 'API keys')).toBe(true);
    // A re-applied mark may carry an empty attrs object; the content and marks are what count.
    expect(docToSnapshot(doc)).toMatchObject(
      page(para(text('Rotate the '), text('API keys', [{ type: 'bold' }]), text(' yearly.'))),
    );
  });

  it('refuses when the text no longer reads as the quote', () => {
    const doc = setUp(page(para(text('Deploy on Monday'))));
    const anchor = anchorOver(doc, 0, 'Monday');
    runOf(doc, 0).insert(runOf(doc, 0).length - 3, 'XX');
    const before = docToSnapshot(doc);
    expect(applyReplacement(doc, anchor, 'Tuesday')).toBe(false);
    expect(docToSnapshot(doc)).toEqual(before);
  });

  it('deletes the anchored words when the fix is empty', () => {
    const doc = setUp(page(para(text('Remove the very word'))));
    expect(applyReplacement(doc, anchorOver(doc, 0, 'very '), '')).toBe(true);
    expect(docToSnapshot(doc)).toEqual(page(para(text('Remove the word'))));
  });
});
