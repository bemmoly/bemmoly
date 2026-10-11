import type { Doc } from 'yjs';
import type { CommentAnchor } from '../../../../shared/comments.ts';
import { anchoredRange } from './anchor.ts';

/**
 * Applies a suggested fix to the live document: the anchored text becomes the replacement,
 * keeping the formatting it had. Runs inside the collab transaction, so every open editor
 * receives it as an ordinary edit. False, and nothing changed, when the anchored text no
 * longer reads as the quote the fix was written against.
 */
export function applyReplacement(doc: Doc, anchor: CommentAnchor, replacement: string): boolean {
  const range = anchoredRange(doc, anchor);
  if (!range) return false;
  doc.transact(() => {
    range.text.delete(range.index, range.length);
    if (replacement) range.text.insert(range.index, replacement, range.attributes);
  });
  return true;
}
