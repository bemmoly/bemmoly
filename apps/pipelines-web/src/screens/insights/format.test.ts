import { describe, expect, it } from 'vitest';
import { trendOf } from './format.ts';

describe('trendOf', () => {
  it('says nothing without an earlier range', () => {
    expect(trendOf('leadTime', 100, null)).toEqual({ kind: 'none' });
  });

  it('reads a shorter lead time as better and more deploys as better', () => {
    expect(trendOf('leadTime', 80, 100)).toEqual({ kind: 'down', change: '20%', better: true });
    expect(trendOf('deployFrequency', 12, 10)).toEqual({ kind: 'up', change: '20%', better: true });
    expect(trendOf('timeToRestore', 120, 100)).toMatchObject({ kind: 'up', better: false });
  });

  it('moves a rate in points and calls small moves the same', () => {
    expect(trendOf('changeFailureRate', 0.024, 0.018)).toEqual({
      kind: 'up',
      change: '0.6',
      better: false,
    });
    expect(trendOf('changeFailureRate', 0.0181, 0.018)).toEqual({ kind: 'same' });
    expect(trendOf('leadTime', 101, 100)).toEqual({ kind: 'same' });
  });
});
