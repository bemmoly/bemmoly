/*
 * The longest common subsequence of two key lists, as matched index pairs in
 * order. Common prefixes and suffixes are matched first (most edits touch a
 * small middle); the middle is solved exactly while it stays under the cell
 * budget, and above it is left unmatched, which the callers turn into
 * deletions, insertions and moves rather than spending seconds on a page.
 */

/** Cells of the DP table solved exactly: 4M uint32s, 16 MB at worst. */
export const LCS_CELL_BUDGET = 4_000_000;

export type MatchedPair = readonly [oldIndex: number, newIndex: number];

function middleLcs(
  a: readonly string[],
  b: readonly string[],
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): MatchedPair[] {
  const n = aEnd - aStart;
  const m = bEnd - bStart;
  if (n === 0 || m === 0 || n * m > LCS_CELL_BUDGET) return [];
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        a[aStart + i] === b[bStart + j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
    }
  }
  const pairs: MatchedPair[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[aStart + i] === b[bStart + j]) {
      pairs.push([aStart + i, bStart + j]);
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

export function longestCommonSubsequence(
  a: readonly string[],
  b: readonly string[],
): MatchedPair[] {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let aEnd = a.length;
  let bEnd = b.length;
  while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) {
    aEnd -= 1;
    bEnd -= 1;
  }
  const prefix: MatchedPair[] = Array.from({ length: start }, (_, index) => [index, index]);
  const suffix: MatchedPair[] = Array.from({ length: a.length - aEnd }, (_, offset) => [
    aEnd + offset,
    bEnd + offset,
  ]);
  return [...prefix, ...middleLcs(a, b, start, aEnd, start, bEnd), ...suffix];
}
