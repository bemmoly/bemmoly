import { backupScheduleSettingsSchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { describeFrequency, dueSlot, latestSlot } from './schedule.ts';

const schedule = (overrides: Record<string, unknown> = {}) =>
  backupScheduleSettingsSchema.parse(overrides);

describe('backup schedule', () => {
  it('defaults to daily at 02:00 UTC, described as nightly', () => {
    const value = schedule();
    expect(value).toMatchObject({ frequency: 'daily', time: '02:00', timezone: 'UTC' });
    expect(describeFrequency(value)).toBe('nightly');
  });

  it('finds the latest daily slot in the workspace timezone', () => {
    const value = schedule({ timezone: 'Asia/Kolkata' });
    // 02:00 in Kolkata is 20:30 UTC the day before; 21:00 UTC is already 02:30 there.
    expect(latestSlot(value, new Date('2026-10-07T21:00:00Z')).toISOString()).toBe(
      '2026-10-07T20:30:00.000Z',
    );
    expect(latestSlot(value, new Date('2026-10-06T20:00:00Z')).toISOString()).toBe(
      '2026-10-05T20:30:00.000Z',
    );
  });

  it('handles hourly, every 6 hours and weekly', () => {
    const now = new Date('2026-10-07T13:20:00Z'); // a Wednesday
    expect(latestSlot(schedule({ frequency: 'hourly', time: '00:15' }), now).toISOString()).toBe(
      '2026-10-07T13:15:00.000Z',
    );
    expect(latestSlot(schedule({ frequency: '6h', time: '02:00' }), now).toISOString()).toBe(
      '2026-10-07T08:00:00.000Z',
    );
    expect(latestSlot(schedule({ frequency: 'weekly', weekday: 0 }), now).toISOString()).toBe(
      '2026-10-04T02:00:00.000Z',
    );
  });

  it('runs a slot once, and catches up a missed slot once', () => {
    const value = schedule();
    const now = new Date('2026-10-07T05:00:00Z');
    const slot = dueSlot(value, new Date('2026-10-06T02:00:00Z'), now);
    expect(slot?.toISOString()).toBe('2026-10-07T02:00:00.000Z');
    expect(dueSlot(value, slot, now)).toBeNull();
    expect(dueSlot(value, null, now)?.toISOString()).toBe('2026-10-07T02:00:00.000Z');
  });

  it('keeps the wall-clock time across a daylight-saving change', () => {
    const value = schedule({ timezone: 'Europe/Berlin' });
    expect(latestSlot(value, new Date('2026-07-01T12:00:00Z')).toISOString()).toBe(
      '2026-07-01T00:00:00.000Z',
    );
    expect(latestSlot(value, new Date('2026-12-01T12:00:00Z')).toISOString()).toBe(
      '2026-12-01T01:00:00.000Z',
    );
  });
});
