import type { BacklogSprint } from '../../../../shared/backlog.ts';
import type { Issue } from '../../../../shared/issues.ts';
import type { Sprint } from '../../../../shared/sprints.ts';

/*
 * The Backlog screen's containers from one rank-ordered list of issues:
 * each open sprint with its issues and committed points, then the backlog,
 * which leaves out finished work the way the screen does.
 */

const points = (issues: readonly Issue[]) =>
  Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;

export function groupBacklog(
  sprints: readonly Sprint[],
  issues: readonly Issue[],
  done: ReadonlySet<string>,
): { sprints: BacklogSprint[]; issues: Issue[] } {
  const bySprint = new Map<string, Issue[]>(sprints.map((sprint) => [sprint.id, []]));
  const backlog: Issue[] = [];
  for (const issue of issues) {
    if (issue.sprintId === null) {
      if (!done.has(issue.statusId)) backlog.push(issue);
      continue;
    }
    bySprint.get(issue.sprintId)?.push(issue);
  }
  return {
    sprints: sprints.map((sprint) => {
      const held = bySprint.get(sprint.id) ?? [];
      return {
        sprint,
        issues: held,
        committedPoints: points(held),
        committedIssues: held.length,
      };
    }),
    issues: backlog,
  };
}
