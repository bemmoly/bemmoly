import { describe, expect, it } from 'vitest';
import { HORIZON_PERIODS, percentile, seededRandom, simulate } from './simulate.ts';

describe('seededRandom', () => {
  it('draws the same numbers from the same seed, and other numbers from another', () => {
    const a = seededRandom('PLT-150');
    const b = seededRandom('PLT-150');
    const c = seededRandom('PLT-160');
    const first = Array.from({ length: 5 }, a);
    expect(Array.from({ length: 5 }, b)).toEqual(first);
    expect(Array.from({ length: 5 }, c)).not.toEqual(first);
    for (const value of first) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('percentile', () => {
  it('takes the nearest rank', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(values, 0.15)).toBe(2);
    expect(percentile(values, 0.5)).toBe(5);
    expect(percentile(values, 0.85)).toBe(9);
    expect(percentile(values, 1)).toBe(10);
    expect(percentile([], 0.5)).toBeNaN();
  });
});

describe('simulate', () => {
  it('gives one answer when every past period was the same', () => {
    expect(simulate({ remaining: 12, samples: [4, 4, 4], share: 1, seed: 'x' })).toEqual({
      earliest: 3,
      likely: 3,
      latest: 3,
    });
  });

  it('counts the last period in part', () => {
    expect(simulate({ remaining: 10, samples: [4], share: 1, seed: 'x' })?.likely).toBe(2.5);
  });

  it('takes twice as long on half the team', () => {
    expect(simulate({ remaining: 12, samples: [4], share: 0.5, seed: 'x' })?.likely).toBe(6);
  });

  it('is done at once when nothing is left', () => {
    expect(simulate({ remaining: 0, samples: [], share: 1, seed: 'x' })).toEqual({
      earliest: 0,
      likely: 0,
      latest: 0,
    });
  });

  it('refuses a history that never finished anything', () => {
    expect(simulate({ remaining: 5, samples: [0, 0, 0], share: 1, seed: 'x' })).toBeNull();
    expect(simulate({ remaining: 5, samples: [], share: 1, seed: 'x' })).toBeNull();
  });

  it('calls a future past the horizon infinite', () => {
    const far = simulate({ remaining: 10_000, samples: [1, 2], share: 1, seed: 'x' });
    expect(far?.latest).toBe(Number.POSITIVE_INFINITY);
    expect(HORIZON_PERIODS).toBe(156);
  });

  it('spreads an uneven history into an ordered range, the same on every run', () => {
    const input = { remaining: 20, samples: [3, 7, 2, 5, 6, 4, 0, 5], share: 1, seed: 'SUP-12' };
    const first = simulate(input);
    expect(simulate(input)).toEqual(first);
    expect(first).not.toBeNull();
    const { earliest, likely, latest } = first ?? { earliest: 0, likely: 0, latest: 0 };
    expect(earliest).toBeLessThan(likely);
    expect(likely).toBeLessThan(latest);
    // Twenty issues at a mean of 4 a week: about five weeks, give or take a week or two.
    expect(likely).toBeGreaterThan(4);
    expect(likely).toBeLessThan(6);
    expect(latest).toBeLessThan(8);
  });
});
