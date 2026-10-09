import { describe, expect, it } from 'vitest';
import { commitmentOf, completionSnapshot, startDates, type SprintIssue } from './snapshot.ts';

const issue = (key: string, estimate: number | null, statusId = 'todo'): SprintIssue => ({
  issueId: `id-${key}`,
  key,
  estimate,
  statusId,
});

const DONE = new Set(['done']);

describe('commitmentOf', () => {
  it('sums the points and counts the issues a sprint starts with', () => {
    expect(commitmentOf([issue('P-1', 3), issue('P-2', 2.5), issue('P-3', null)])).toEqual({
      committedPoints: 5.5,
      committedIssues: 3,
      issueIds: ['id-P-1', 'id-P-2', 'id-P-3'],
    });
  });
});

describe('completionSnapshot', () => {
  const held = [issue('P-1', 3, 'done'), issue('P-2', 5), issue('P-4', 1, 'done')];

  it('keeps the commitment from the start and counts what finished', () => {
    const snapshot = completionSnapshot(
      held,
      DONE,
      { committedPoints: 8, committedIssues: 2, issueIds: ['id-P-1', 'id-P-2'] },
      'next-sprint',
    );
    expect(snapshot).toEqual({
      committedPoints: 8,
      completedPoints: 4,
      committedIssues: 2,
      completedIssues: 2,
      carriedOverTo: 'next-sprint',
      issues: [
        { issueId: 'id-P-1', key: 'P-1', estimate: 3, completed: true },
        { issueId: 'id-P-2', key: 'P-2', estimate: 5, completed: false },
        { issueId: 'id-P-4', key: 'P-4', estimate: 1, completed: true },
      ],
    });
  });

  it('counts everything held at close as committed when the start left no commitment', () => {
    const snapshot = completionSnapshot(held, DONE, null, null);
    expect(snapshot).toMatchObject({ committedPoints: 9, committedIssues: 3, carriedOverTo: null });
  });
});

describe('startDates', () => {
  const now = new Date('2026-03-10T09:00:00.000Z');

  it('prefers the request, then the plan, then now and the cadence', () => {
    expect(startDates({ startsAt: null, endsAt: null }, {}, now, 14)).toEqual({
      startsAt: '2026-03-10T09:00:00.000Z',
      endsAt: '2026-03-24T09:00:00.000Z',
    });
    expect(
      startDates(
        { startsAt: '2026-03-11T00:00:00.000Z', endsAt: '2026-03-18T00:00:00.000Z' },
        { endsAt: '2026-03-25T00:00:00.000Z' },
        now,
        14,
      ),
    ).toEqual({ startsAt: '2026-03-11T00:00:00.000Z', endsAt: '2026-03-25T00:00:00.000Z' });
  });
});
