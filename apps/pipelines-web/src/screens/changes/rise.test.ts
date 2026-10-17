import { describe, expect, it } from 'vitest';
import { riseOf } from './rise.ts';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 17, 13, minute)).toISOString();

describe('riseOf', () => {
  it('reads the level before the rise and the latest value', () => {
    const series = {
      label: '5xx',
      source: 'metrics' as const,
      points: [
        [at(0), 0.2],
        [at(10), 0.3],
        [at(20), 0.2],
        [at(30), 0.9],
        [at(40), 1.9],
      ] as [string, number][],
      riseAt: at(25),
    };
    expect(riseOf(series)).toEqual({ from: 0.2, to: 1.9, at: at(25) });
  });

  it('says nothing when the series did not rise', () => {
    expect(riseOf({ label: '5xx', source: 'metrics', points: [], riseAt: null })).toBeNull();
  });
});
