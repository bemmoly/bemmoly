import { describe, expect, it } from 'vitest';
import { addDays, datesProblem, dayOf, endOf, plannedDays, startOf } from './sprint-dates.ts';

describe('sprint dates', () => {
  const today = new Date('2026-10-09T12:00:00.000Z');

  it('keeps a planned sprint on its own days', () => {
    expect(
      plannedDays(
        { startsAt: '2026-10-07T00:00:00.000Z', endsAt: '2026-10-21T23:59:59.000Z' },
        14,
        today,
      ),
    ).toEqual({ start: '2026-10-07', end: '2026-10-21' });
  });

  it('starts an undated sprint today and runs it for the board cadence', () => {
    expect(plannedDays({ startsAt: null, endsAt: null }, 14, today)).toEqual({
      start: '2026-10-09',
      end: '2026-10-22',
    });
  });

  it('sends whole days and reads them back', () => {
    expect(startOf('2026-10-07')).toBe('2026-10-07T00:00:00.000Z');
    expect(endOf('2026-10-21')).toBe('2026-10-21T23:59:59.000Z');
    expect(dayOf(endOf('2026-10-21'))).toBe('2026-10-21');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('refuses a sprint that ends before it starts', () => {
    expect(datesProblem('2026-10-07', '2026-10-06')).toMatch(/end on or after/);
    expect(datesProblem('2026-10-07', '2026-10-07')).toBeNull();
    expect(datesProblem('', '2026-10-07')).toBe('Choose both dates.');
  });
});
