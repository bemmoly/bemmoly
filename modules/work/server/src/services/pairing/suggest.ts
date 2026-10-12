import type { PairingCell, PairingSuggestion } from '../../../../shared/pairing.ts';

/*
 * Next pairs, greedily: every two people ranked by how little they paired (never first, then
 * fewest shared issues, then longest ago), and each taken while both are still free. An odd
 * person out is left unpaired rather than tripled. The order of `people` breaks the last ties,
 * so the same matrix always gives the same suggestions.
 */
export function suggestPairs(
  people: readonly string[],
  cells: readonly PairingCell[],
): PairingSuggestion[] {
  const key = (a: string, b: string) => (a < b ? `${a},${b}` : `${b},${a}`);
  const byPair = new Map(cells.map((cell) => [key(cell.a, cell.b), cell]));
  const candidates: (PairingSuggestion & { order: number })[] = [];
  people.forEach((a, i) =>
    people.slice(i + 1).forEach((b) => {
      const cell = byPair.get(key(a, b));
      candidates.push({
        a,
        b,
        count: cell?.count ?? 0,
        lastPairedAt: cell?.lastPairedAt ?? null,
        order: candidates.length,
      });
    }),
  );
  candidates.sort(
    (x, y) =>
      x.count - y.count ||
      (x.lastPairedAt ?? '').localeCompare(y.lastPairedAt ?? '') ||
      x.order - y.order,
  );
  const taken = new Set<string>();
  const pairs: PairingSuggestion[] = [];
  for (const { a, b, count, lastPairedAt } of candidates) {
    if (taken.has(a) || taken.has(b)) continue;
    taken.add(a);
    taken.add(b);
    pairs.push({ a, b, count, lastPairedAt });
  }
  return pairs;
}
