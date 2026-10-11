import { attrChanges, canonical, similarity, textOf } from './canonical.ts';
import { diffInline } from './inline.ts';
import { longestCommonSubsequence, type MatchedPair } from './sequence.ts';
import type { BlockDiff, DiffNode } from './types.ts';

/*
 * Block-level diff, applied at the top of the document and again inside any
 * container that changed. Four passes:
 *   1. identical blocks in order (the longest common subsequence) are equal;
 *   2. an identical block found elsewhere is a move;
 *   3. between two equal blocks, an old and a new block of the same type
 *      that read alike are one block changed in place;
 *   4. left over, an old and a new block that read very alike across the
 *      document are a block moved and edited.
 * Whatever remains is a deletion or an insertion.
 */

/** Same-place pairs this alike are an edit, not a replacement. */
export const CHANGE_THRESHOLD = 0.4;
/** Pairs found elsewhere must be this alike to count as one block moved and edited. */
export const MOVED_EDIT_THRESHOLD = 0.75;
/** Comparisons pass 4 may spend; past it, leftovers stay deletions and insertions. */
const MOVED_EDIT_BUDGET = 40_000;

/** Children of these sit in slots (cells in a row, rows in a table): same-place means same block. */
const POSITIONAL = new Set(['table', 'tableRow', 'tableCell', 'tableHeader']);

const INLINE_TYPES = new Set(['text', 'hardBreak', 'mention', 'pageLink', 'issueEmbed', 'emoji']);
const isInlineContent = (nodes: readonly DiffNode[] | undefined) =>
  (nodes ?? []).every((node) => typeof node.text === 'string' || INLINE_TYPES.has(node.type));

interface Partner {
  index: number;
  kind: 'move' | 'change';
}

interface Gap {
  oldFrom: number;
  oldTo: number;
  newFrom: number;
  newTo: number;
}

function gapsBetween(pairs: readonly MatchedPair[], oldLength: number, newLength: number): Gap[] {
  const gaps: Gap[] = [];
  let oldFrom = 0;
  let newFrom = 0;
  for (const [oldIndex, newIndex] of [...pairs, [oldLength, newLength] as const]) {
    gaps.push({ oldFrom, oldTo: oldIndex, newFrom, newTo: newIndex });
    oldFrom = oldIndex + 1;
    newFrom = newIndex + 1;
  }
  return gaps;
}

/** One block whose content changed, at the same place or moved. */
export function changedBlock(
  before: DiffNode,
  after: DiffNode,
  oldIndex: number,
  newIndex: number,
  op: 'change' | 'move' = 'change',
): BlockDiff {
  const entry: BlockDiff = { op, type: after.type, oldIndex, newIndex, before, after };
  const attrs = attrChanges(before, after);
  if (attrs) entry.attrs = attrs;
  if (isInlineContent(before.content) && isInlineContent(after.content)) {
    entry.inline = diffInline(before.content, after.content);
  } else {
    entry.children = diffBlocks(before.content ?? [], after.content ?? [], {
      positional: POSITIONAL.has(after.type),
    });
  }
  return entry;
}

const pairable = (before: DiffNode, after: DiffNode, threshold: number) =>
  before.type === after.type && similarity(before, after) >= threshold;

/**
 * `positional` is for a container whose children are slots: there, an old
 * and a new block of the same type between the same neighbours are one block
 * changed however little they share, as a table cell edited from "May" to
 * "June" is.
 */
export function diffBlocks(
  before: readonly DiffNode[],
  after: readonly DiffNode[],
  options: { positional?: boolean } = {},
): BlockDiff[] {
  const changeThreshold = options.positional ? 0 : CHANGE_THRESHOLD;
  const oldKeys = before.map(canonical);
  const newKeys = after.map(canonical);
  const pairs = longestCommonSubsequence(oldKeys, newKeys);
  const matchedOld = new Set(pairs.map(([oldIndex]) => oldIndex));
  const matchedNew = new Set(pairs.map(([, newIndex]) => newIndex));
  const oldPartner = new Map<number, Partner>();
  const newPartner = new Map<number, Partner>();
  const link = (oldIndex: number, newIndex: number, kind: Partner['kind']) => {
    oldPartner.set(oldIndex, { index: newIndex, kind });
    newPartner.set(newIndex, { index: oldIndex, kind });
  };
  const freeOld = (from = 0, to = before.length) =>
    range(from, to).filter((i) => !matchedOld.has(i) && !oldPartner.has(i));
  const freeNew = (from = 0, to = after.length) =>
    range(from, to).filter((j) => !matchedNew.has(j) && !newPartner.has(j));

  const byKey = new Map<string, number[]>();
  for (const i of freeOld()) byKey.set(oldKeys[i]!, [...(byKey.get(oldKeys[i]!) ?? []), i]);
  for (const j of freeNew()) {
    const i = byKey.get(newKeys[j]!)?.shift();
    if (i !== undefined) link(i, j, 'move');
  }

  const gaps = gapsBetween(pairs, before.length, after.length);
  for (const gap of gaps) {
    const news = freeNew(gap.newFrom, gap.newTo);
    let cursor = 0;
    for (const i of freeOld(gap.oldFrom, gap.oldTo)) {
      const found = news
        .slice(cursor)
        .findIndex((j) => pairable(before[i]!, after[j]!, changeThreshold));
      if (found < 0) continue;
      link(i, news[cursor + found]!, 'change');
      cursor += found + 1;
    }
  }

  const leftOld = freeOld();
  const leftNew = freeNew();
  if (leftOld.length * leftNew.length <= MOVED_EDIT_BUDGET) {
    for (const i of leftOld) {
      if (textOf(before[i]!).trim() === '') continue;
      const j = leftNew.find(
        (candidate) =>
          !newPartner.has(candidate) &&
          pairable(before[i]!, after[candidate]!, MOVED_EDIT_THRESHOLD),
      );
      if (j !== undefined) link(i, j, 'move');
    }
  }

  const out: BlockDiff[] = [];
  gaps.forEach((gap, index) => {
    let i = gap.oldFrom;
    let j = gap.newFrom;
    while (i < gap.oldTo || j < gap.newTo) {
      const oldPartnerOf = oldPartner.get(i);
      if (i < gap.oldTo && oldPartnerOf?.kind !== 'change') {
        out.push(oldOnly(before[i]!, i, oldPartnerOf));
        i += 1;
      } else if (j < gap.newTo && newPartner.get(j)?.kind !== 'change') {
        out.push(newOnly(before, after[j]!, j, newPartner.get(j)));
        j += 1;
      } else {
        out.push(changedBlock(before[i]!, after[j]!, i, j));
        i += 1;
        j += 1;
      }
    }
    const pair = pairs[index];
    if (pair) {
      const node = after[pair[1]]!;
      out.push({ op: 'equal', type: node.type, oldIndex: pair[0], newIndex: pair[1], after: node });
    }
  });
  return out;
}

function oldOnly(node: DiffNode, i: number, partner: Partner | undefined): BlockDiff {
  return partner
    ? { op: 'move_source', type: node.type, oldIndex: i, newIndex: partner.index, before: node }
    : { op: 'delete', type: node.type, oldIndex: i, newIndex: null, before: node };
}

function newOnly(
  before: readonly DiffNode[],
  node: DiffNode,
  j: number,
  partner: Partner | undefined,
): BlockDiff {
  if (!partner) return { op: 'insert', type: node.type, oldIndex: null, newIndex: j, after: node };
  const was = before[partner.index]!;
  if (canonical(was) === canonical(node)) {
    return { op: 'move', type: node.type, oldIndex: partner.index, newIndex: j, after: node };
  }
  return changedBlock(was, node, partner.index, j, 'move');
}

const range = (from: number, to: number) =>
  Array.from({ length: Math.max(0, to - from) }, (_, offset) => from + offset);
