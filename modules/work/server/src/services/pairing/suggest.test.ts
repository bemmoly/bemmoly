import { describe, expect, it } from 'vitest';
import type { PairingCell } from '../../../../shared/pairing.ts';
import { suggestPairs } from './suggest.ts';

const cell = (a: string, b: string, count: number, lastPairedAt: string): PairingCell => ({
  a,
  b,
  count,
  hours: count,
  lastPairedAt,
  issues: [],
});

describe('suggested pairs', () => {
  it('puts people who never paired together first, each person once', () => {
    const cells = [
      cell('ana', 'ben', 5, '2026-10-01T00:00:00.000Z'),
      cell('cat', 'dan', 4, '2026-10-01T00:00:00.000Z'),
      cell('ana', 'cat', 1, '2026-09-01T00:00:00.000Z'),
    ];
    const pairs = suggestPairs(['ana', 'ben', 'cat', 'dan'], cells);
    expect(pairs.map((pair) => `${pair.a}+${pair.b}`)).toEqual(['ana+dan', 'ben+cat']);
    expect(pairs[0]).toMatchObject({ count: 0, lastPairedAt: null });
  });

  it('prefers the pair that paired longest ago when everyone has paired', () => {
    const cells = [
      cell('ana', 'ben', 1, '2026-10-01T00:00:00.000Z'),
      cell('ana', 'cat', 1, '2026-08-01T00:00:00.000Z'),
      cell('ben', 'cat', 1, '2026-09-01T00:00:00.000Z'),
    ];
    expect(suggestPairs(['ana', 'ben', 'cat'], cells)).toEqual([
      { a: 'ana', b: 'cat', count: 1, lastPairedAt: '2026-08-01T00:00:00.000Z' },
    ]);
  });

  it('suggests nothing for fewer than two people', () => {
    expect(suggestPairs(['ana'], [])).toEqual([]);
  });
});
