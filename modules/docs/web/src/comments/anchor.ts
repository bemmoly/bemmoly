import type { Node as PmNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import { decodeRelativePosition, encodeRelativePosition, type Doc, type XmlFragment } from 'yjs';
import type { CommentAnchor } from '../../../shared/comments.ts';

/*
 * An inline comment's anchor, in the shape the server reads: a pair of Yjs relative positions
 * (base64 of Y.encodeRelativePosition) and the selected text, blocks joined by "\n". Relative
 * positions follow their characters through every edit, by anyone; the quote is what the
 * thread shows when the text it pointed at is gone.
 */

/** The server keeps at most this much of a quote. */
export const QUOTE_MAX = 2000;

export interface TextRange {
  from: number;
  to: number;
}

type ProsemirrorMapping = Parameters<typeof absolutePositionToRelativePosition>[2];

interface SyncState {
  type: XmlFragment;
  doc: Doc;
  binding: { mapping: ProsemirrorMapping } | null;
}

/** The collaboration binding of an editor state, or null when the editor is not shared. */
function syncOf(state: EditorState): SyncState | null {
  const sync = ySyncPluginKey.getState(state) as SyncState | undefined;
  return sync?.binding ? sync : null;
}

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

function fromBase64(value: string): Uint8Array | null {
  try {
    const raw = atob(value);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** The selected text as the server compares it: blocks on their own lines. */
export const quoteOf = (doc: PmNode, range: TextRange) =>
  doc.textBetween(range.from, range.to, '\n');

export type CaptureResult =
  { ok: true; anchor: CommentAnchor } | { ok: false; reason: 'empty' | 'too-long' | 'not-shared' };

/** The anchor for the current selection, or why the selection cannot carry one. */
export function captureAnchor(state: EditorState): CaptureResult {
  const { from, to, empty } = state.selection;
  const quote = empty ? '' : quoteOf(state.doc, { from, to });
  if (!normalize(quote)) return { ok: false, reason: 'empty' };
  if (quote.length > QUOTE_MAX) return { ok: false, reason: 'too-long' };
  const sync = syncOf(state);
  if (!sync?.binding) return { ok: false, reason: 'not-shared' };
  const { mapping } = sync.binding;
  const encode = (pos: number) =>
    toBase64(encodeRelativePosition(absolutePositionToRelativePosition(pos, sync.type, mapping)));
  return { ok: true, anchor: { from: encode(from), to: encode(to), quote } };
}

/** Where an anchor's relative positions point now, when both ends still exist in order. */
export function resolvePositions(state: EditorState, anchor: CommentAnchor): TextRange | null {
  const sync = syncOf(state);
  if (!sync?.binding) return null;
  const at = (encoded: string) => {
    const bytes = fromBase64(encoded);
    if (!bytes?.length) return null;
    try {
      const relative = decodeRelativePosition(bytes);
      return relativePositionToAbsolutePosition(
        sync.doc,
        sync.type,
        relative,
        sync.binding!.mapping,
      );
    } catch {
      return null;
    }
  };
  const from = at(anchor.from);
  const to = at(anchor.to);
  if (from === null || to === null || to <= from || to > state.doc.content.size) return null;
  return { from, to };
}

/**
 * The first place the quote appears, matching whitespace loosely and reading blocks as lines.
 * The fallback for a page whose document was rebuilt (the dev mock's tab-local copy), where
 * the positions name items that no longer exist but the words are still there.
 */
export function findQuote(doc: PmNode, quote: string): TextRange | null {
  const wanted = normalize(quote);
  if (!wanted) return null;
  let text = '';
  const positions: number[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock && text.length > 0 && !text.endsWith(' ')) {
      text += ' ';
      positions.push(-1);
    }
    if (!node.isText) return true;
    for (let i = 0; i < node.text!.length; i += 1) {
      const char = node.text![i]!;
      const space = /\s/.test(char);
      if (space && text.endsWith(' ')) continue;
      text += space ? ' ' : char;
      positions.push(pos + i);
    }
    return false;
  });
  const index = text.indexOf(wanted);
  if (index < 0) return null;
  const from = positions[index];
  const last = positions[index + wanted.length - 1];
  if (from === undefined || last === undefined || from < 0 || last < 0) return null;
  return { from, to: last + 1 };
}

/**
 * Where to highlight an anchored thread: its positions when they still span the quote,
 * else the quote found by its words. Null when the text is gone, so the thread shows its
 * quote with "text changed".
 */
export function locateAnchor(state: EditorState, anchor: CommentAnchor): TextRange | null {
  const range = resolvePositions(state, anchor);
  if (range && normalize(quoteOf(state.doc, range)) === normalize(anchor.quote)) return range;
  return findQuote(state.doc, anchor.quote);
}
