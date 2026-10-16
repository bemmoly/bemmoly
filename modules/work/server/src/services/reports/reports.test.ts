import { describe, expect, it } from 'vitest';
import { controlPoints, cycleStats } from './control.ts';
import { scopeWeeks, weekCutoffs } from './scope.ts';
import { statusStays } from './time-in-status.ts';

const at = (iso: string) => Date.parse(iso);
const DAY = 24 * 60 * 60 * 1000;

describe('controlPoints', () => {
  const issues = new Map([
    ['a', { key: 'R-1', title: 'A' }],
    ['b', { key: 'R-2', title: 'B' }],
    ['c', { key: 'R-3', title: 'C' }],
  ]);
  const points = controlPoints(
    [
      {
        issueId: 'b',
        startedAt: at('2026-03-01T00:00:00Z'),
        completedAt: at('2026-03-05T12:00:00Z'),
      },
      {
        issueId: 'a',
        startedAt: at('2026-03-02T00:00:00Z'),
        completedAt: at('2026-03-03T00:00:00Z'),
      },
      {
        issueId: 'c',
        startedAt: at('2026-01-01T00:00:00Z'),
        completedAt: at('2026-01-02T00:00:00Z'),
      },
    ],
    issues,
    at('2026-03-01T00:00:00Z'),
  );

  it('keeps the issues finished in the window, oldest first, with their cycle days', () => {
    expect(points.map((point) => [point.key, point.cycleDays])).toEqual([
      ['R-1', 1],
      ['R-2', 4.5],
    ]);
  });

  it('gives the mean and median, or nothing without points', () => {
    expect(cycleStats(points)).toEqual({ meanDays: 2.8, medianDays: 2.8 });
    expect(cycleStats([])).toEqual({ meanDays: null, medianDays: null });
  });
});

describe('statusStays', () => {
  /*
   * A window of 10 days from 1 March. A was in To do before the window, moved to Doing on
   * day 2 and Done on day 6. B was created on day 4 in To do and is still there.
   */
  const start = at('2026-03-01T00:00:00Z');
  const end = start + 10 * DAY;
  const stays = statusStays(
    [
      { id: 'A', statusId: 'done', createdAt: at('2026-02-01T00:00:00Z'), deletedAt: null },
      { id: 'B', statusId: 'todo', createdAt: start + 4 * DAY, deletedAt: null },
    ],
    [
      { issueId: 'A', from: 'todo', to: 'doing', at: start + 2 * DAY },
      { issueId: 'A', from: 'doing', to: 'done', at: start + 6 * DAY },
    ],
    start,
    end,
  );

  it('clips each stay to the window and counts the issues that stood there', () => {
    expect(stays.get('todo')).toEqual({ totalMs: 8 * DAY, issues: 2 });
    expect(stays.get('doing')).toEqual({ totalMs: 4 * DAY, issues: 1 });
    expect(stays.get('done')).toEqual({ totalMs: 4 * DAY, issues: 1 });
  });
});

describe('scopeWeeks', () => {
  const now = at('2026-03-29T12:00:00Z');

  it('ends a week every seven days, the last one now', () => {
    expect(weekCutoffs(now, 2)).toEqual([now - 7 * DAY, now]);
  });

  /*
   * Three weeks of an epic: X (3) was in it throughout and finished in the last week, Y (5)
   * joined in the middle week, Z (2) left in the last week.
   */
  it('rewinds membership, status and estimate to each week', () => {
    const weeks = scopeWeeks({
      targetId: 'epic',
      issues: [
        { id: 'X', member: 'epic', statusId: 'done', estimate: 3, createdAt: 0, deletedAt: null },
        { id: 'Y', member: 'epic', statusId: 'todo', estimate: 5, createdAt: 0, deletedAt: null },
        { id: 'Z', member: null, statusId: 'todo', estimate: 2, createdAt: 0, deletedAt: null },
      ],
      changes: [
        { issueId: 'Y', field: 'member', from: null, at: now - 10 * DAY },
        { issueId: 'Z', field: 'member', from: 'epic', at: now - 2 * DAY },
        { issueId: 'X', field: 'statusId', from: 'todo', at: now - DAY },
      ],
      done: new Set(['done']),
      now,
      weeks: 3,
    });
    expect(weeks.map((week) => [week.scopePoints, week.completedPoints, week.scopeIssues])).toEqual(
      [
        [5, 0, 2],
        [10, 0, 3],
        [8, 3, 2],
      ],
    );
  });
});
