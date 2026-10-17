import { describe, expect, it } from 'vitest';
import { formatAge, formatSpan } from './format.ts';

describe('narrow times', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');
  it.each([
    ['2026-10-17T11:48:00Z', '12m'],
    ['2026-10-17T08:00:00Z', '4h'],
    ['2026-10-14T12:00:00Z', '3d'],
    ['2026-07-01T12:00:00Z', '15w'],
  ])('says %s ago as %s', (iso, expected) => {
    expect(formatAge(iso, now, 'en')).toBe(expected);
  });

  it('drops seconds past a minute and shows days for long lead times', () => {
    expect(formatSpan(9_612, 'en')).toBe('2h 40m');
    expect(formatSpan(42, 'en')).toBe('42s');
    expect(formatSpan(97_200, 'en')).toBe('1d 3h');
  });
});
