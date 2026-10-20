import type { VelocityPoint } from '../../../../shared/metrics.ts';
import type { SprintChanges, SprintScope } from '../../../../shared/reports.ts';
import { sprintSnapshotSchema } from '../../../../shared/sprints.ts';

/*
 * Spillover and scope added after the start. Both come from what is already
 * recorded: the completion snapshot names the sprint unfinished work went to
 * and every issue the sprint held at close, and the commitment written at
 * the start lists the issues it began with. Pure, so it is tested alone.
 */

/** The unfinished issues closed sprints handed on, by receiving sprint, with their points. */
export type Handoffs = ReadonlyMap<string, ReadonlyMap<string, number | null>>;

export function handoffsByTarget(snapshots: readonly unknown[]): Handoffs {
  const byTarget = new Map<string, Map<string, number | null>>();
  for (const raw of snapshots) {
    const parsed = sprintSnapshotSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.carriedOverTo) continue;
    const target = byTarget.get(parsed.data.carriedOverTo) ?? new Map<string, number | null>();
    for (const issue of parsed.data.issues) {
      if (!issue.completed) target.set(issue.issueId, issue.estimate);
    }
    byTarget.set(parsed.data.carriedOverTo, target);
  }
  return byTarget;
}

const round = (points: number) => Math.round(points * 100) / 100;
const sum = (estimates: Iterable<number | null>) => {
  let total = 0;
  for (const estimate of estimates) total += estimate ?? 0;
  return round(total);
};

export interface ClosedSprint {
  id: string;
  name: string;
  snapshot: unknown;
  /** The issues it started with; null for a sprint started before they were recorded. */
  startIssueIds: readonly string[] | null;
}

/**
 * A closed sprint's velocity point. Without a recorded start, everything it
 * held at close counts as committed (as the snapshot does), so nothing reads
 * as added.
 */
export function velocityPoint(sprint: ClosedSprint, handoffs: Handoffs): VelocityPoint {
  const parsed = sprintSnapshotSchema.safeParse(sprint.snapshot);
  const snapshot = parsed.success ? parsed.data : null;
  const held = snapshot?.issues ?? [];
  const atStart = new Set(sprint.startIssueIds ?? held.map((issue) => issue.issueId));
  const added = held.filter((issue) => !atStart.has(issue.issueId));
  const carried = [...(handoffs.get(sprint.id) ?? new Map<string, number | null>())].filter(
    ([issueId]) => atStart.has(issueId),
  );
  return {
    sprintId: sprint.id,
    name: sprint.name,
    committedPoints: snapshot?.committedPoints ?? 0,
    completedPoints: snapshot?.completedPoints ?? 0,
    committedIssues: snapshot?.committedIssues ?? 0,
    completedIssues: snapshot?.completedIssues ?? 0,
    scopeIssues: held.length,
    scopePoints: sum(held.map((issue) => issue.estimate)),
    carriedOverIssues: carried.length,
    carriedOverPoints: sum(carried.map(([, estimate]) => estimate)),
    addedIssues: added.length,
    addedPoints: sum(added.map((issue) => issue.estimate)),
  };
}

/** The sprint report's totals, read off its lists so the two always agree. */
export function sprintChanges(scope: SprintScope): SprintChanges {
  const held = [...scope.completed, ...scope.notCompleted];
  return {
    scopeIssues: held.length,
    scopePoints: sum(held.map((issue) => issue.estimate)),
    carriedOverIssues: scope.carriedOver.length,
    carriedOverPoints: sum(scope.carriedOver.map((issue) => issue.estimate)),
    addedIssues: scope.added.length,
    addedPoints: sum(scope.added.map((issue) => issue.estimate)),
  };
}
