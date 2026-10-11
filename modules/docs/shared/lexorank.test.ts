import { describe, expect, it } from 'vitest';
import {
  between,
  compareRanks,
  first,
  isLexorank,
  last,
  lexorankSchema,
  needsRebalance,
  REBALANCE_LENGTH,
  spread,
} from './lexorank.ts';

describe('lexorank', () => {
  it('opens a list in the middle and grows outward from it', () => {
    expect(first()).toBe('n');
    expect(last()).toBe('n');
    expect(first('n')).toBe('g');
    expect(last('n')).toBe('t');
    expect(first('b')).toBe('an');
    expect(last('z')).toBe('zn');
  });

  it('finds a rank strictly between any two neighbours', () => {
    const pairs: [string | null, string | null][] = [
      ['b', 'c'],
      ['b', 'd'],
      ['bz', 'c'],
      ['n', 'nb'],
      [null, 'b'],
      ['zz', null],
      ['abc', 'abd'],
      ['ab', 'abb'],
    ];
    for (const [before, after] of pairs) {
      const rank = between(before, after);
      expect(isLexorank(rank)).toBe(true);
      if (before !== null) expect(compareRanks(before, rank)).toBe(-1);
      if (after !== null) expect(compareRanks(rank, after)).toBe(-1);
    }
  });

  it('refuses neighbours out of order, equal, or not ranks', () => {
    expect(() => between('c', 'b')).toThrow(RangeError);
    expect(() => between('b', 'b')).toThrow(RangeError);
    expect(() => between('ba', 'c')).toThrow(RangeError);
    expect(() => between(null, 'B')).toThrow(RangeError);
  });

  it('keeps order through a thousand drops at one spot', () => {
    let lower = 'b';
    const upper = 'c';
    for (let i = 0; i < 1000; i++) {
      const next = between(lower, upper);
      expect(compareRanks(lower, next)).toBe(-1);
      expect(compareRanks(next, upper)).toBe(-1);
      lower = next;
    }
    expect(needsRebalance([lower])).toBe(true);
    expect(needsRebalance(['b', 'n', 'zz'])).toBe(false);
    expect(needsRebalance(['b'.repeat(REBALANCE_LENGTH)])).toBe(false);
  });

  it('spreads evenly spaced ranks that leave room everywhere', () => {
    expect(spread(0)).toEqual([]);
    expect(spread(1)).toEqual(['n']);
    const ranks = spread(500);
    expect(ranks).toHaveLength(500);
    expect([...ranks].sort(compareRanks)).toEqual(ranks);
    expect(new Set(ranks).size).toBe(500);
    for (const rank of ranks) expect(isLexorank(rank)).toBe(true);
    expect(isLexorank(between(null, ranks[0] ?? null))).toBe(true);
    expect(isLexorank(between(ranks.at(-1) ?? null, null))).toBe(true);
    expect(() => spread(-1)).toThrow(RangeError);
  });

  it('validates ranks as the API receives them', () => {
    expect(lexorankSchema.parse('hn')).toBe('hn');
    expect(lexorankSchema.safeParse('ha').success).toBe(false);
    expect(lexorankSchema.safeParse('').success).toBe(false);
    expect(lexorankSchema.safeParse('H').success).toBe(false);
  });
});
