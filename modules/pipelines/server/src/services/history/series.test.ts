import { describe, expect, it } from 'vitest';
import { riseOf } from './series.ts';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 16, 14, minute)).toISOString();

describe('the rise in an error series', () => {
  it('finds the first point of a rise that holds', () => {
    const points = [0.2, 0.3, 0.2, 0.25, 0.3, 4.1, 5.2, 6.0].map((v, i) => [at(i), v] as const);
    expect(riseOf(points)).toBe(at(5));
  });

  it('ignores a single spike and a flat line', () => {
    const spike = [0.2, 0.2, 0.3, 5, 0.2, 0.3].map((v, i) => [at(i), v] as const);
    expect(riseOf(spike)).toBeNull();
    expect(riseOf([0.2, 0.2, 0.2, 0.2].map((v, i) => [at(i), v] as const))).toBeNull();
  });
});
