import { describe, expect, it } from 'vitest';
import {
  barHeights,
  fractionOf,
  rangeOf,
  stepValue,
  valueAt,
  valueAtFraction,
} from './scrub-math.ts';

const STEP = 15 * 60_000;
const starts = Array.from({ length: 96 }, (_, index) =>
  new Date(Date.UTC(2026, 9, 16, 11) + index * STEP).toISOString(),
);
const range = rangeOf(starts, STEP);

describe('scrub math', () => {
  it('runs from the first bucket to the end of the last', () => {
    expect(range.max - range.min).toBe(96 * STEP);
  });

  it('puts live at the end and a time at its share of the range', () => {
    expect(fractionOf(null, range)).toBe(1);
    expect(fractionOf(starts[48] ?? '', range)).toBeCloseTo(0.5);
  });

  it('snaps to a bucket start, and to live within half a bucket of the end', () => {
    expect(valueAt(range.min + STEP * 10 + 1000, range)).toBe(starts[10]);
    expect(valueAt(range.max - STEP / 3, range)).toBeNull();
    expect(valueAtFraction(-1, range)).toBe(starts[0]);
    expect(valueAtFraction(1, range)).toBeNull();
  });

  it('steps back from live into the last bucket and forward past the end to live', () => {
    expect(stepValue(null, -STEP, range)).toBe(starts[95]);
    expect(stepValue(starts[95] ?? '', STEP, range)).toBeNull();
    expect(stepValue(starts[10] ?? '', -4 * STEP, range)).toBe(starts[6]);
  });

  it('scales bars to the tallest with a visible stub for quiet buckets', () => {
    expect(barHeights([0, 5, 10])).toEqual([0.08, 0.5, 1]);
    expect(barHeights([0, 0])).toEqual([0.08, 0.08]);
  });
});
