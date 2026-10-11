/** The usual constant: it damps the head of each list so no single ranking dominates. */
export const RRF_K = 60;

/**
 * Reciprocal rank fusion: each ranked list gives an item 1 / (k + rank), rank from 1, and the
 * fused order is by the sum. An item found by both the vectors and the keywords beats one
 * found high by only one of them. Ties keep the order the items were first seen in.
 */
export function fuseRankings(lists: readonly (readonly string[])[], k = RRF_K): string[] {
  const scores = new Map<string, { score: number; seen: number }>();
  let seen = 0;
  for (const list of lists) {
    const counted = new Set<string>();
    list.forEach((item, index) => {
      if (counted.has(item)) return;
      counted.add(item);
      const entry = scores.get(item) ?? { score: 0, seen: seen++ };
      entry.score += 1 / (k + index + 1);
      scores.set(item, entry);
    });
  }
  return [...scores.entries()]
    .sort(([, a], [, b]) => b.score - a.score || a.seen - b.seen)
    .map(([item]) => item);
}
