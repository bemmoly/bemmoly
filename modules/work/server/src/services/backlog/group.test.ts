import { describe, expect, it } from 'vitest';
import type { Issue } from '../../../../shared/issues.ts';
import type { Sprint } from '../../../../shared/sprints.ts';
import { groupBacklog } from './group.ts';

const sprint = (id: string): Sprint => ({ id, name: id }) as Sprint;

const issue = (key: string, sprintId: string | null, estimate: number | null, statusId = 'todo') =>
  ({ id: key, key, sprintId, estimate, statusId }) as Issue;

describe('groupBacklog', () => {
  it('fills each sprint in the order given and leaves finished work out of the backlog', () => {
    const grouped = groupBacklog(
      [sprint('active'), sprint('next')],
      [
        issue('P-1', 'active', 3),
        issue('P-2', null, 2),
        issue('P-3', 'next', null),
        issue('P-4', 'active', 1.5, 'done'),
        issue('P-5', null, 1, 'done'),
        issue('P-6', 'closed-or-unknown', 8),
        issue('P-7', null, null),
      ],
      new Set(['done']),
    );
    expect(
      grouped.sprints.map((s) => [
        s.sprint.id,
        s.issues.map((i) => i.key),
        s.committedPoints,
        s.committedIssues,
      ]),
    ).toEqual([
      ['active', ['P-1', 'P-4'], 4.5, 2],
      ['next', ['P-3'], 0, 1],
    ]);
    expect(grouped.issues.map((i) => i.key)).toEqual(['P-2', 'P-7']);
  });
});

describe('groupBacklog with a query', () => {
  it('keeps only the matching rows but counts every issue of a sprint in its points', () => {
    const grouped = groupBacklog(
      [sprint('active')],
      [issue('P-1', 'active', 3), issue('P-2', 'active', 2), issue('P-3', null, 1)],
      new Set(['done']),
      new Set(['P-1']),
    );
    expect(grouped.sprints[0]?.issues.map((i) => i.key)).toEqual(['P-1']);
    expect(grouped.sprints[0]?.committedPoints).toBe(5);
    expect(grouped.issues).toEqual([]);
  });
});
