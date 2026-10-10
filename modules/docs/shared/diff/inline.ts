import { canonical, marksKey, TOKEN } from './canonical.ts';
import { longestCommonSubsequence } from './sequence.ts';
import type { InlinePart, DiffMark, DiffNode } from './types.ts';

/*
 * Inline changes inside a text block: the words that were inserted or
 * deleted, and the words whose marks changed (made bold, linked, unlinked).
 * Text is compared word by word, never character by character, so a changed
 * word reads as that word replaced. Inline nodes (mentions, page links, hard
 * breaks) are single tokens.
 */

interface Token {
  /** What the sequence match compares: the text, or the node without its marks. */
  key: string;
  text?: string;
  node?: DiffNode;
  marks: DiffMark[];
  marksKey: string;
}

function tokenize(content: readonly DiffNode[] | undefined): Token[] {
  const tokens: Token[] = [];
  for (const node of content ?? []) {
    const marks = node.marks ?? [];
    const key = marksKey(marks);
    if (typeof node.text === 'string') {
      for (const piece of node.text.match(TOKEN) ?? []) {
        tokens.push({ key: `t:${piece}`, text: piece, marks, marksKey: key });
      }
    } else {
      const bare: DiffNode = { ...node };
      delete bare.marks;
      tokens.push({ key: `n:${canonical(bare)}`, node: bare, marks, marksKey: key });
    }
  }
  return tokens;
}

const partOf = (op: InlinePart['op'], token: Token, before?: Token): InlinePart => ({
  op,
  ...(token.text !== undefined ? { text: token.text } : {}),
  ...(token.node ? { node: token.node } : {}),
  marks: token.marks,
  ...(before ? { beforeMarks: before.marks } : {}),
});

const sameRun = (a: InlinePart, b: InlinePart) =>
  a.op === b.op &&
  a.text !== undefined &&
  b.text !== undefined &&
  marksKey(a.marks) === marksKey(b.marks) &&
  marksKey(a.beforeMarks) === marksKey(b.beforeMarks);

/** Adjacent text runs with the same op and marks become one run. */
function merge(parts: InlinePart[]): InlinePart[] {
  const merged: InlinePart[] = [];
  for (const part of parts) {
    const last = merged.at(-1);
    if (last && sameRun(last, part)) last.text = `${last.text}${part.text}`;
    else merged.push({ ...part });
  }
  return merged;
}

/**
 * The runs that turn one text block's content into another's. Within each
 * stretch between unchanged words, deletions come before insertions, which
 * is how a reader expects "old → new" to read.
 */
export function diffInline(
  before: readonly DiffNode[] | undefined,
  after: readonly DiffNode[] | undefined,
): InlinePart[] {
  const old = tokenize(before);
  const now = tokenize(after);
  const pairs = longestCommonSubsequence(
    old.map((token) => token.key),
    now.map((token) => token.key),
  );
  const parts: InlinePart[] = [];
  let i = 0;
  let j = 0;
  const flushUntil = (oldEnd: number, newEnd: number) => {
    for (; i < oldEnd; i += 1) parts.push(partOf('delete', old[i]!));
    for (; j < newEnd; j += 1) parts.push(partOf('insert', now[j]!));
  };
  for (const [oldIndex, newIndex] of pairs) {
    flushUntil(oldIndex, newIndex);
    const was = old[oldIndex]!;
    const is = now[newIndex]!;
    parts.push(was.marksKey === is.marksKey ? partOf('equal', is) : partOf('format', is, was));
    i = oldIndex + 1;
    j = newIndex + 1;
  }
  flushUntil(old.length, now.length);
  return merge(parts);
}

/** True when the runs hold any change at all. */
export const inlineChanged = (parts: readonly InlinePart[]) =>
  parts.some((part) => part.op !== 'equal');
