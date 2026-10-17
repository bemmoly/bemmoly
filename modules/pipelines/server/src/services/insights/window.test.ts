import { describe, expect, it } from 'vitest';
import { windowOf } from './index.ts';

const NOW = new Date('2026-10-17T09:30:00Z');

describe('windowOf', () => {
  it('ends today and puts the range before it just before', () => {
    expect(windowOf('30d', new Date('2025-01-01T00:00:00Z'), NOW)).toEqual({
      days: 30,
      previousDays: 30,
      from: '2026-09-18',
      previousFrom: '2026-08-19',
    });
  });

  it('counts only the days that have history', () => {
    const window = windowOf('90d', new Date('2026-10-11T00:00:00Z'), NOW);
    expect(window.days).toBe(7);
    expect(window.previousDays).toBe(1);
    expect(windowOf('30d', null, NOW).days).toBe(1);
  });
});
