import { describe, expect, it } from 'vitest';
import { ISSUE_LIMIT, timeTracking, type TimeLog } from './time-tracking.ts';

const DAY = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-03-01T00:00:00Z');
const window = { start: START, end: START + 13 * DAY + 12 * 60 * 60 * 1000 };

const log = (overrides: Partial<TimeLog>): TimeLog => ({
  issueId: 'i1',
  key: 'REP-1',
  title: 'One',
  estimate: 3,
  userId: 'u1',
  name: 'Ana',
  minutes: 60,
  startedAt: START,
  ...overrides,
});

describe('timeTracking', () => {
  it('sums the window by week, person and issue, most first', () => {
    const report = timeTracking(
      [
        log({}),
        log({ userId: 'u2', name: 'Ben', minutes: 120, startedAt: START + 8 * DAY }),
        log({ issueId: 'i2', key: 'REP-2', title: 'Two', estimate: null, minutes: 30 }),
        // Outside the window on both sides.
        log({ startedAt: START - 1 }),
        log({ startedAt: window.end + 1 }),
      ],
      window,
    );
    expect(report).toMatchObject({ from: '2026-03-01', to: '2026-03-14', totalMinutes: 210 });
    expect(report.weeks).toEqual([
      { date: '2026-03-01', minutes: 90 },
      { date: '2026-03-08', minutes: 120 },
    ]);
    expect(report.people.map((person) => [person.name, person.minutes])).toEqual([
      ['Ben', 120],
      ['Ana', 90],
    ]);
    expect(report.issues.map((issue) => [issue.key, issue.estimate, issue.minutes])).toEqual([
      ['REP-1', 3, 180],
      ['REP-2', null, 30],
    ]);
  });

  it('keeps one empty week for an empty window and caps the issue list', () => {
    expect(timeTracking([], { start: START, end: START })).toMatchObject({
      totalMinutes: 0,
      weeks: [{ date: '2026-03-01', minutes: 0 }],
      people: [],
      issues: [],
    });
    const many = Array.from({ length: ISSUE_LIMIT + 5 }, (_, n) =>
      log({ issueId: `i${n}`, key: `REP-${n}`, minutes: n + 1 }),
    );
    const report = timeTracking(many, window);
    expect(report.issues).toHaveLength(ISSUE_LIMIT);
    expect(report.issues[0]?.minutes).toBe(ISSUE_LIMIT + 5);
  });
});
