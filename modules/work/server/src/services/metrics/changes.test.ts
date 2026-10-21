import { describe, expect, it } from 'vitest';
import { handoffsByTarget, sprintChanges, velocityPoint } from './changes.ts';

const S1 = '00000000-0000-7000-8000-000000000001';
const S2 = '00000000-0000-7000-8000-000000000002';
const id = (n: number) => `00000000-0000-7000-8000-0000000001${String(n).padStart(2, '0')}`;

const snapshot = (
  carriedOverTo: string | null,
  issues: [number, number | null, boolean][],
  committed = { points: 0, issues: 0 },
) => ({
  committedPoints: committed.points,
  completedPoints: 0,
  committedIssues: committed.issues,
  completedIssues: 0,
  carriedOverTo,
  issues: issues.map(([n, estimate, completed]) => ({
    issueId: id(n),
    key: `K-${n}`,
    estimate,
    completed,
  })),
});

describe('handoffsByTarget', () => {
  it('keeps the unfinished issues each sprint handed on, by the sprint that got them', () => {
    const handoffs = handoffsByTarget([
      snapshot(S2, [
        [1, 3, true],
        [2, 5, false],
        [3, null, false],
      ]),
      snapshot(null, [[4, 2, false]]),
      { not: 'a snapshot' },
    ]);
    expect([...(handoffs.get(S2) ?? [])]).toEqual([
      [id(2), 5],
      [id(3), null],
    ]);
    expect(handoffs.size).toBe(1);
  });
});

describe('velocityPoint', () => {
  const held = snapshot(
    null,
    [
      [2, 5, true],
      [3, 1, false],
      [5, 2, true],
      [6, 4, false],
    ],
    { points: 6, issues: 2 },
  );
  const handoffs = new Map([
    [
      S2,
      new Map<string, number | null>([
        [id(2), 5],
        [id(9), 8],
      ]),
    ],
  ]);

  it('counts spillover the sprint started with and scope that joined after the start', () => {
    const point = velocityPoint(
      { id: S2, name: 'Sprint 2', snapshot: held, startIssueIds: [id(2), id(3)] },
      handoffs,
    );
    expect(point).toMatchObject({
      committedPoints: 6,
      committedIssues: 2,
      scopeIssues: 4,
      scopePoints: 12,
      carriedOverIssues: 1,
      carriedOverPoints: 5,
      addedIssues: 2,
      addedPoints: 6,
    });
  });

  it('reads nothing as added for a sprint whose start was not recorded', () => {
    const point = velocityPoint(
      { id: S1, name: 'Sprint 1', snapshot: held, startIssueIds: null },
      handoffs,
    );
    expect(point).toMatchObject({ addedIssues: 0, addedPoints: 0, carriedOverIssues: 0 });
  });
});

describe('sprintChanges', () => {
  it('totals the lists of the sprint report', () => {
    const row = (n: number, estimate: number | null) => ({
      issueId: id(n),
      key: `K-${n}`,
      title: `Issue ${n}`,
      estimate,
    });
    expect(
      sprintChanges({
        completed: [row(1, 3)],
        notCompleted: [row(2, 5), row(3, null)],
        added: [row(3, null)],
        removed: [row(4, 1)],
        carriedOver: [row(2, 5)],
      }),
    ).toEqual({
      scopeIssues: 3,
      scopePoints: 8,
      carriedOverIssues: 1,
      carriedOverPoints: 5,
      addedIssues: 1,
      addedPoints: 0,
    });
  });
});
