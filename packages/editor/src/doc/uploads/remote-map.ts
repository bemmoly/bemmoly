import type { Node as PmNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/*
 * Live collaboration applies someone else's edit as one step that replaces the whole
 * document, so mapping a position through it collapses it to the start. For those
 * transactions the position is mapped by what actually changed: the content before the
 * first difference and after the last one is the same in both documents.
 */

const SYNC_META = 'y-sync$';

export function isRemoteReplace(tr: Transaction): boolean {
  const meta = tr.getMeta(SYNC_META) as { isChangeOrigin?: boolean } | undefined;
  return Boolean(meta?.isChangeOrigin);
}

/** Where `pos` in `before` lands in `after`, by the span that differs between them. */
export function mapByDiff(before: PmNode, after: PmNode, pos: number): number {
  const start = before.content.findDiffStart(after.content);
  if (start === null || pos <= start) return Math.min(pos, after.content.size);
  const found = before.content.findDiffEnd(after.content);
  if (!found) return Math.min(pos, after.content.size);
  // The two scans can overlap when the change repeats what is around it.
  const overlap = Math.max(0, start - Math.min(found.a, found.b));
  const end = { a: found.a + overlap, b: found.b + overlap };
  if (pos >= end.a) return Math.max(0, Math.min(pos + (end.b - end.a), after.content.size));
  return Math.min(start, after.content.size);
}
