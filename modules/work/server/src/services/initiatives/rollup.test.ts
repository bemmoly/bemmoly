import { describe, expect, it } from 'vitest';
import { rollUp, rollupOf, type RollupRow } from './rollup.ts';

/* The rollup sums what a person can open and only counts the rest as hidden. */

const row = (over: Partial<RollupRow>): RollupRow => ({
  initiative_id: 'i1',
  epic_id: 'e1',
  project_id: 'p1',
  epic_done: false,
  total: 4,
  done: 1,
  in_progress: 2,
  points: '8',
  points_done: '3',
  ...over,
});

describe('rolling up an initiative', () => {
  it('sums the issues under visible epics across projects', () => {
    const rollups = rollUp(
      [
        row({}),
        row({
          epic_id: 'e2',
          project_id: 'p2',
          epic_done: true,
          total: 2,
          done: 2,
          in_progress: 0,
          points: '5',
          points_done: '5',
        }),
        row({ epic_id: 'e3', project_id: 'secret', total: 9 }),
      ],
      (id) => id !== 'secret',
    );
    expect(rollupOf(rollups, 'i1')).toEqual({
      epics: { total: 2, done: 1, hidden: 1 },
      progress: { total: 6, done: 3, inProgress: 2, points: 13, pointsDone: 8 },
      projectIds: ['p1', 'p2'],
    });
  });

  it('gives an initiative without epics zeros', () => {
    expect(
      rollupOf(
        rollUp([], () => true),
        'none',
      ),
    ).toEqual({
      epics: { total: 0, done: 0, hidden: 0 },
      progress: { total: 0, done: 0, inProgress: 0, points: 0, pointsDone: 0 },
      projectIds: [],
    });
  });
});
