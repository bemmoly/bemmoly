import { describe, expect, it } from 'vitest';
import { windowOpen, windowText } from './window.ts';

describe('deploy windows', () => {
  const weekdays = {
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    from: '10:00',
    to: '18:00',
    timeZone: 'Asia/Kolkata',
  };

  it('is open any time without a window', () => {
    expect(windowOpen(null, new Date('2026-11-01T03:00:00Z'))).toBe(true);
  });

  it('reads the hours in the environment’s own time zone', () => {
    // 05:00 UTC on a Tuesday is 10:30 in Kolkata.
    expect(windowOpen(weekdays, new Date('2026-11-03T05:00:00Z'))).toBe(true);
    expect(windowOpen(weekdays, new Date('2026-11-03T03:00:00Z'))).toBe(false);
    // A Sunday.
    expect(windowOpen(weekdays, new Date('2026-11-01T06:00:00Z'))).toBe(false);
  });

  it('runs a window past midnight into the next day', () => {
    const night = { days: ['fri'], from: '22:00', to: '02:00', timeZone: 'UTC' };
    expect(windowOpen(night, new Date('2026-11-06T23:00:00Z'))).toBe(true);
    expect(windowOpen(night, new Date('2026-11-07T01:00:00Z'))).toBe(true);
    expect(windowOpen(night, new Date('2026-11-07T03:00:00Z'))).toBe(false);
  });

  it('says the window in words', () => {
    expect(windowText(weekdays)).toBe('Mon to Fri, 10:00 to 18:00 Asia/Kolkata');
  });
});
