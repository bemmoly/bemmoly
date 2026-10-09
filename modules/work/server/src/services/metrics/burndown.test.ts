import { describe, expect, it } from 'vitest';
import {
  burndown,
  dayCutoffs,
  MAX_BURNDOWN_DAYS,
  stateAt,
  type BurndownIssue,
  type FieldChange,
} from './burndown.ts';

const at = (iso: string) => Date.parse(iso);
const SPRINT = 'sprint';
const TODO = 'todo';
const DONE = 'done';

const issue = (id: string, state: Partial<BurndownIssue>): BurndownIssue => ({
  id,
  createdAt: at('2026-03-09T12:00:00Z'),
  deletedAt: null,
  sprintId: SPRINT,
  statusId: TODO,
  estimate: null,
  ...state,
});

/*
 * A three-day sprint: A finishes on day one, B is re-estimated from 5 to 8 on
 * day two, D joins on day two, E is created and deleted on day two, C leaves
 * for the backlog on day three, and F was done before the sprint began.
 */
const ISSUES = [
  issue('A', { statusId: DONE, estimate: 3 }),
  issue('B', { estimate: 8 }),
  issue('C', { sprintId: null, estimate: 2 }),
  issue('D', { estimate: 1 }),
  issue('E', {
    estimate: 4,
    createdAt: at('2026-03-11T08:00:00Z'),
    deletedAt: at('2026-03-11T20:00:00Z'),
  }),
  issue('F', { statusId: DONE, estimate: 2 }),
];

const CHANGES: FieldChange[] = [
  { issueId: 'A', field: 'statusId', from: TODO, at: at('2026-03-10T15:00:00Z') },
  { issueId: 'B', field: 'estimate', from: 5, at: at('2026-03-11T12:00:00Z') },
  { issueId: 'D', field: 'sprintId', from: null, at: at('2026-03-11T10:00:00Z') },
  { issueId: 'C', field: 'sprintId', from: SPRINT, at: at('2026-03-12T00:30:00Z') },
];

describe('burndown', () => {
  it('rebuilds the remaining points at the end of each day from history', () => {
    expect(
      burndown({
        sprintId: SPRINT,
        issues: ISSUES,
        changes: CHANGES,
        done: new Set([DONE]),
        start: at('2026-03-10T09:00:00Z'),
        end: at('2026-03-12T18:00:00Z'),
      }),
    ).toEqual([
      { date: '2026-03-10', remainingPoints: 7 },
      { date: '2026-03-11', remainingPoints: 11 },
      { date: '2026-03-12', remainingPoints: 9 },
    ]);
  });

  it('draws nothing for a sprint whose end comes before its start', () => {
    const input = { sprintId: SPRINT, issues: ISSUES, changes: CHANGES, done: new Set([DONE]) };
    expect(burndown({ ...input, start: at('2026-03-12T00:00:00Z'), end: 0 })).toEqual([]);
  });
});

describe('stateAt', () => {
  it('undoes every change after the instant, newest first', () => {
    const changes: FieldChange[] = [
      { issueId: 'B', field: 'estimate', from: 5, at: at('2026-03-11T12:00:00Z') },
      { issueId: 'B', field: 'estimate', from: 3, at: at('2026-03-10T12:00:00Z') },
    ];
    const b = issue('B', { estimate: 8 });
    expect(stateAt(b, changes, at('2026-03-10T00:00:00Z'))?.estimate).toBe(3);
    expect(stateAt(b, changes, at('2026-03-10T18:00:00Z'))?.estimate).toBe(5);
    expect(stateAt(b, changes, at('2026-03-12T00:00:00Z'))?.estimate).toBe(8);
  });

  it('has no state before creation or after deletion', () => {
    const e = ISSUES[4] as BurndownIssue;
    expect(stateAt(e, [], at('2026-03-11T07:00:00Z'))).toBeNull();
    expect(stateAt(e, [], at('2026-03-11T12:00:00Z'))?.estimate).toBe(4);
    expect(stateAt(e, [], at('2026-03-11T21:00:00Z'))).toBeNull();
  });
});

describe('dayCutoffs', () => {
  it('ends each day at its last millisecond and the last day at the end', () => {
    expect(dayCutoffs(at('2026-03-10T09:00:00Z'), at('2026-03-11T06:00:00Z'))).toEqual([
      at('2026-03-10T23:59:59.999Z'),
      at('2026-03-11T06:00:00Z'),
    ]);
  });

  it('stops at the longest series it draws', () => {
    expect(dayCutoffs(0, at('2027-01-01T00:00:00Z'))).toHaveLength(MAX_BURNDOWN_DAYS);
  });
});
