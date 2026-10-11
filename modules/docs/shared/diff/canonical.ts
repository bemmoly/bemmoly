import type { DiffMark, DiffNode } from './types.ts';

/*
 * What makes two blocks "the same": their JSON with keys in a fixed order, so
 * two snapshots written by different code paths compare equal. And how alike
 * two different blocks are, to tell an edited paragraph from a replaced one.
 */

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, inner]) => inner !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, inner]) => [key, canonicalValue(inner)]));
  }
  return value;
}

/** A stable string for a node or mark: equal strings mean equal content. */
export const canonical = (value: unknown): string => JSON.stringify(canonicalValue(value)) ?? '';

/** The marks of a text node as one comparable key; order does not matter. */
export const marksKey = (marks: readonly DiffMark[] | undefined): string =>
  (marks ?? []).map(canonical).sort().join('|');

/** The text a block shows, blocks separated by a space; inline atoms count as their label. */
export function textOf(node: DiffNode): string {
  if (typeof node.text === 'string') return node.text;
  const label = node.attrs?.label ?? node.attrs?.title;
  if (!node.content && typeof label === 'string') return label;
  return (node.content ?? []).map(textOf).join(node.content?.some(isBlockLike) ? ' ' : '');
}

const isBlockLike = (node: DiffNode) => node.content !== undefined && node.text === undefined;

/** Words, runs of space and single punctuation marks, the units an inline diff works in. */
export const TOKEN = /[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu;

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];

/**
 * How alike two blocks read, from 0 to 1: the Dice coefficient of their
 * words. Two blocks with no text at all (images, rules) count as half alike
 * so an image whose caption changed can still pair with itself.
 */
export function similarity(a: DiffNode, b: DiffNode): number {
  const left = words(textOf(a));
  const right = words(textOf(b));
  if (left.length === 0 && right.length === 0) return 0.5;
  if (left.length === 0 || right.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const word of left) counts.set(word, (counts.get(word) ?? 0) + 1);
  let common = 0;
  for (const word of right) {
    const count = counts.get(word) ?? 0;
    if (count > 0) {
      common += 1;
      counts.set(word, count - 1);
    }
  }
  return (2 * common) / (left.length + right.length);
}

/** Attributes whose values differ, by key; undefined when none do. */
export function attrChanges(
  before: DiffNode,
  after: DiffNode,
): Record<string, { before: unknown; after: unknown }> | undefined {
  const keys = new Set([...Object.keys(before.attrs ?? {}), ...Object.keys(after.attrs ?? {})]);
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    const was = before.attrs?.[key] ?? null;
    const now = after.attrs?.[key] ?? null;
    if (canonical(was) !== canonical(now)) changes[key] = { before: was, after: now };
  }
  return Object.keys(changes).length > 0 ? changes : undefined;
}
