import type { SprintSnapshot } from '../../../../shared/sprints.ts';

/*
 * The numbers a sprint keeps: what it committed to when it started and what
 * it finished by the time it closed. Pure, so the arithmetic is tested
 * without a database.
 */

export interface SprintIssue {
  issueId: string;
  key: string;
  estimate: number | null;
  statusId: string;
}

/** Written into sprint_metrics when a sprint starts; the close reads its committed figures. */
export interface Commitment {
  committedPoints: number;
  committedIssues: number;
  issueIds: string[];
}

const points = (issues: readonly SprintIssue[]): number =>
  Math.round(issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0) * 100) / 100;

export function commitmentOf(issues: readonly SprintIssue[]): Commitment {
  return {
    committedPoints: points(issues),
    committedIssues: issues.length,
    issueIds: issues.map((issue) => issue.issueId),
  };
}

/**
 * The completion snapshot. Committed figures come from the start when the
 * sprint has them, so scope added later shows as completed work beyond the
 * commitment rather than inflating it; without them, everything the sprint
 * holds at close counts as committed.
 */
export function completionSnapshot(
  issues: readonly SprintIssue[],
  done: ReadonlySet<string>,
  commitment: Commitment | null,
  carriedOverTo: string | null,
): SprintSnapshot {
  const completed = issues.filter((issue) => done.has(issue.statusId));
  return {
    committedPoints: commitment?.committedPoints ?? points(issues),
    completedPoints: points(completed),
    committedIssues: commitment?.committedIssues ?? issues.length,
    completedIssues: completed.length,
    carriedOverTo,
    issues: issues.map((issue) => ({
      issueId: issue.issueId,
      key: issue.key,
      estimate: issue.estimate,
      completed: done.has(issue.statusId),
    })),
  };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * The dates a sprint starts with: what the request gives, else what the
 * sprint was planned with, else now and the board's cadence.
 */
export function startDates(
  planned: { startsAt: string | null; endsAt: string | null },
  requested: { startsAt?: string | undefined; endsAt?: string | undefined },
  now: Date,
  cadenceDays: number,
): { startsAt: string; endsAt: string } {
  const startsAt = requested.startsAt ?? planned.startsAt ?? now.toISOString();
  const endsAt =
    requested.endsAt ??
    planned.endsAt ??
    new Date(new Date(startsAt).getTime() + cadenceDays * DAY).toISOString();
  return { startsAt, endsAt };
}
