import { describe, expect, it } from 'vitest';
import type { FieldChange } from './burndown.ts';
import { burnup, sprintScope, type ReportIssue } from './burnup.ts';

const at = (iso: string) => Date.parse(iso);
const SPRINT = 'sprint';
const TODO = 'todo';
const DONE = 'done';

const issue = (id: string, state: Partial<ReportIssue>): ReportIssue => ({
  id,
  key: `R-${id}`,
  title: `Issue ${id}`,
  createdAt: at('2026-03-09T12:00:00Z'),
  deletedAt: null,
  sprintId: SPRINT,
  statusId: TODO,
  estimate: 1,
  ...state,
});

/*
 * A two-day sprint from 10 March 09:00: A (3) finishes on day one, B (5)
 * stays open, C (2) joins on day two, D (4) leaves on day two.
 */
const INPUT = {
  sprintId: SPRINT,
  issues: [
    issue('A', { statusId: DONE, estimate: 3 }),
    issue('B', { estimate: 5 }),
    issue('C', { estimate: 2 }),
    issue('D', { sprintId: null, estimate: 4 }),
  ],
  changes: [
    { issueId: 'A', field: 'statusId', from: TODO, at: at('2026-03-10T15:00:00Z') },
    { issueId: 'C', field: 'sprintId', from: null, at: at('2026-03-11T10:00:00Z') },
    { issueId: 'D', field: 'sprintId', from: SPRINT, at: at('2026-03-11T11:00:00Z') },
  ] satisfies FieldChange[],
  done: new Set([DONE]),
  start: at('2026-03-10T09:00:00Z'),
  end: at('2026-03-11T18:00:00Z'),
};

describe('burnup', () => {
  it('draws scope and completed points at the end of each day', () => {
    expect(burnup(INPUT)).toEqual([
      { date: '2026-03-10', scopePoints: 12, completedPoints: 3 },
      { date: '2026-03-11', scopePoints: 10, completedPoints: 3 },
    ]);
  });

  it('is empty when the end is before the start', () => {
    expect(burnup({ ...INPUT, end: INPUT.start - 1 })).toEqual([]);
  });
});

describe('sprintScope', () => {
  it('sorts the issues into completed, open, added and removed', () => {
    const scope = sprintScope(INPUT);
    const keys = (list: { key: string }[]) => list.map((row) => row.key);
    expect(keys(scope.completed)).toEqual(['R-A']);
    expect(keys(scope.notCompleted)).toEqual(['R-B', 'R-C']);
    expect(keys(scope.added)).toEqual(['R-C']);
    expect(keys(scope.removed)).toEqual(['R-D']);
    expect(scope.removed[0]?.estimate).toBe(4);
  });

  it('counts an issue created after the start as added', () => {
    const late = issue('E', { createdAt: at('2026-03-11T08:00:00Z') });
    const scope = sprintScope({ ...INPUT, issues: [late] });
    expect(scope.added.map((row) => row.key)).toEqual(['R-E']);
  });
});
