import type { Backlog, Issue } from '@bemmoly/module-work/shared';
import { sumPoints } from '../backlog/move.ts';
import { previousOf, stillHeld, type QuickPatch } from './issue-edit-patch.ts';

/*
 * A quick edit on a cached backlog, pure. The issue takes the new fields where it is; a sprint
 * change moves it into the other container at its own rank, and both containers' committed
 * points and counts follow. Taking it back reverses only the fields that still hold the edit.
 */

/** The issue with this key in any container, or undefined. */
export function findIssue(backlog: Backlog, key: string): Issue | undefined {
  for (const entry of backlog.sprints) {
    const found = entry.issues.find((issue) => issue.key === key);
    if (found) return found;
  }
  return backlog.issues.find((issue) => issue.key === key);
}

const byRank = (a: Issue, b: Issue) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0);

/** The list with the issue left out (by id) and, when `into`, put back at its rank. */
function relist(issues: readonly Issue[], issue: Issue, into: boolean): Issue[] {
  const rest = issues.filter((row) => row.id !== issue.id);
  return into ? [...rest, issue].sort(byRank) : rest;
}

function apply(issue: Issue, patch: QuickPatch): Issue {
  const next = { ...issue };
  if (patch.assigneeId !== undefined) next.assigneeId = patch.assigneeId;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.sprintId !== undefined) next.sprintId = patch.sprintId;
  return next;
}

export function patchBacklog(backlog: Backlog, key: string, patch: QuickPatch): Backlog {
  const issue = findIssue(backlog, key);
  if (!issue) return backlog;
  const next = apply(issue, patch);
  if (next.sprintId === issue.sprintId) {
    const swap = (issues: Issue[]) => issues.map((row) => (row.id === issue.id ? next : row));
    return {
      ...backlog,
      sprints: backlog.sprints.map((entry) =>
        entry.issues.includes(issue) ? { ...entry, issues: swap(entry.issues) } : entry,
      ),
      issues: backlog.issues.includes(issue) ? swap(backlog.issues) : backlog.issues,
    };
  }
  return {
    ...backlog,
    sprints: backlog.sprints.map((entry) => {
      const id = entry.sprint.id;
      if (id !== issue.sprintId && id !== next.sprintId) return entry;
      const issues = relist(entry.issues, next, id === next.sprintId);
      return {
        ...entry,
        issues,
        committedPoints: sumPoints(issues),
        committedIssues: issues.length,
      };
    }),
    issues:
      issue.sprintId === null || next.sprintId === null
        ? relist(backlog.issues, next, next.sprintId === null)
        : backlog.issues,
  };
}

/**
 * Takes a failed edit back. `before` is the issue as the backlog held it before the edit;
 * fields a later edit or a fresher read changed stay as they are.
 */
export function revertBacklog(backlog: Backlog, before: Issue, patch: QuickPatch): Backlog {
  const issue = findIssue(backlog, before.key);
  if (!issue) return backlog;
  const held = stillHeld(issue, patch);
  if (held.length === 0) return backlog;
  const back: QuickPatch = {};
  for (const field of held) Object.assign(back, previousOf(before, { [field]: patch[field] }));
  return patchBacklog(backlog, before.key, back);
}
