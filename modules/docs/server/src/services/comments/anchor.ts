import { editorSchema } from '@bemmoly/editor/schema';
import { initProseMirrorDoc, relativePositionToAbsolutePosition } from '@tiptap/y-tiptap';
import {
  createAbsolutePositionFromRelativePosition,
  decodeRelativePosition,
  XmlText,
  type Doc,
  type RelativePosition,
} from 'yjs';
import type { AnchorStatus, CommentAnchor } from '../../../../shared/comments.ts';
import { PAGE_FIELD } from '../collab/convert.ts';

/*
 * An inline comment's anchor is a pair of Yjs relative positions (base64 of
 * Y.encodeRelativePosition) plus the text that was selected. Relative
 * positions follow their characters through every edit; this reads where they
 * point now. The anchor still holds when the text between them is the quote;
 * otherwise the text changed (or was deleted) and the thread falls back to
 * the quote it kept.
 */

/** A position from the wire, or null when it is not one (the anchor reads as lost). */
export function decodePosition(encoded: string): RelativePosition | null {
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length === 0) return null;
  try {
    const position = decodeRelativePosition(new Uint8Array(bytes));
    // A position names an item, a root type or a type; bytes that decode to none are junk.
    return position.item || position.tname || position.type ? position : null;
  } catch {
    return null;
  }
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Reads anchors against one document; the ProseMirror view of it is built once, on demand. */
export function createAnchorReader(doc: Doc) {
  const fragment = doc.getXmlFragment(PAGE_FIELD);
  let view: ReturnType<typeof initProseMirrorDoc> | null = null;
  const pm = () => (view ??= initProseMirrorDoc(fragment, editorSchema()));

  /** The text the anchor spans now, or null when either end is gone or they crossed. */
  function currentText(anchor: CommentAnchor): string | null {
    const from = decodePosition(anchor.from);
    const to = decodePosition(anchor.to);
    if (!from || !to) return null;
    const { doc: pmDoc, mapping } = pm();
    const start = relativePositionToAbsolutePosition(doc, fragment, from, mapping);
    const end = relativePositionToAbsolutePosition(doc, fragment, to, mapping);
    if (start === null || end === null || end <= start || end > pmDoc.content.size) return null;
    return pmDoc.textBetween(start, end, '\n');
  }

  return {
    currentText,
    status(anchor: CommentAnchor): AnchorStatus {
      const text = currentText(anchor);
      return text !== null && normalize(text) === normalize(anchor.quote)
        ? 'anchored'
        : 'text_changed';
    },
  };
}

export interface TextRange {
  text: XmlText;
  index: number;
  length: number;
  /** The formatting at the start, so a replacement keeps the words' marks. */
  attributes: Record<string, unknown>;
}

const plain = (text: XmlText) =>
  (text.toDelta() as { insert: unknown }[])
    .map((op) => (typeof op.insert === 'string' ? op.insert : '￼'))
    .join('');

function attributesAt(text: XmlText, index: number): Record<string, unknown> {
  let offset = 0;
  for (const op of text.toDelta() as { insert: unknown; attributes?: Record<string, unknown> }[]) {
    const size = typeof op.insert === 'string' ? op.insert.length : 1;
    if (index < offset + size) return op.attributes ?? {};
    offset += size;
  }
  return {};
}

/**
 * The anchored run of one text node, when the anchor sits inside a single run of text and
 * still reads as its quote. A fix spanning blocks or inline nodes is not one this can apply.
 */
export function anchoredRange(doc: Doc, anchor: CommentAnchor): TextRange | null {
  const fromPos = decodePosition(anchor.from);
  const toPos = decodePosition(anchor.to);
  if (!fromPos || !toPos) return null;
  const from = createAbsolutePositionFromRelativePosition(fromPos, doc);
  const to = createAbsolutePositionFromRelativePosition(toPos, doc);
  if (!from || !to || from.type !== to.type || !(from.type instanceof XmlText)) return null;
  if (to.index <= from.index) return null;
  const run = plain(from.type).slice(from.index, to.index);
  if (run !== anchor.quote) return null;
  return {
    text: from.type,
    index: from.index,
    length: to.index - from.index,
    attributes: attributesAt(from.type, from.index),
  };
}
