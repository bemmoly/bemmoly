import { describe, expect, it } from 'vitest';
import { PRINT_MARGINS, PRINT_PAPERS, PRINT_TYPE } from './print.ts';

const points = (value: string) => Number(value.replace('pt', ''));

describe('print tokens', () => {
  it('sets paper type in points, rising from meta to the title', () => {
    const steps = Object.values(PRINT_TYPE);
    expect(steps.every((step) => /^\d+(\.\d+)?pt$/.test(step))).toBe(true);
    const sizes = steps.map(points);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
    expect(points(PRINT_TYPE.body)).toBeGreaterThanOrEqual(10);
  });

  it('prints on A4 and Letter with room for the running header and footer', () => {
    expect(Object.keys(PRINT_PAPERS)).toEqual(['a4', 'letter']);
    expect(Number.parseFloat(PRINT_MARGINS.top)).toBeGreaterThanOrEqual(15);
    expect(Number.parseFloat(PRINT_MARGINS.bottom)).toBeGreaterThanOrEqual(15);
  });
});
