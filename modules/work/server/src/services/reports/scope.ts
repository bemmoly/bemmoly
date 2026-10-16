import type { ScopeWeek } from '../../../../shared/reports.ts';
import { utcDate } from '../metrics/burndown.ts';

/*
 * An epic's or version's burnup by week: the points and issues that belonged
 * to it at the end of each week, and how many of them were done. Membership,
 * status and estimate are each rewound from history, as the sprint burndown
 * does for its sprint.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

export type ScopeField = 'member' | 'statusId' | 'estimate';

export interface ScopeIssue {
  id: string;
  /** The epic (parent) or version the issue belongs to now. */
  member: string | null;
  statusId: string;
  estimate: number | null;
  createdAt: number;
  deletedAt: number | null;
}

export interface ScopeChange {
  issueId: string;
  field: ScopeField;
  from: unknown;
  at: number;
}

export interface ScopeInput {
  targetId: string;
  issues: readonly ScopeIssue[];
  changes: readonly ScopeChange[];
  done: ReadonlySet<string>;
  now: number;
  weeks: number;
}

/** The end of each of the last `weeks` weeks, the last one being now. */
export function weekCutoffs(now: number, weeks: number): number[] {
  return Array.from({ length: weeks }, (_, index) => now - (weeks - 1 - index) * WEEK);
}

const asId = (value: unknown) => (typeof value === 'string' ? value : null);
const round = (points: number) => Math.round(points * 100) / 100;

export function scopeWeeks(input: ScopeInput): ScopeWeek[] {
  const byIssue = new Map<string, ScopeChange[]>();
  for (const change of input.changes) {
    const list = byIssue.get(change.issueId) ?? [];
    list.push(change);
    byIssue.set(change.issueId, list);
  }
  for (const list of byIssue.values()) list.sort((a, b) => b.at - a.at);

  return weekCutoffs(input.now, input.weeks).map((cutoff) => {
    const week = { scopePoints: 0, completedPoints: 0, scopeIssues: 0, completedIssues: 0 };
    for (const issue of input.issues) {
      if (issue.createdAt > cutoff) continue;
      if (issue.deletedAt !== null && issue.deletedAt <= cutoff) continue;
      let { member, statusId, estimate } = issue;
      for (const change of byIssue.get(issue.id) ?? []) {
        if (change.at <= cutoff) break;
        if (change.field === 'member') member = asId(change.from);
        else if (change.field === 'statusId') statusId = asId(change.from) ?? statusId;
        else
          estimate = change.from === null || change.from === undefined ? null : Number(change.from);
      }
      if (member !== input.targetId) continue;
      week.scopeIssues += 1;
      week.scopePoints += estimate ?? 0;
      if (input.done.has(statusId)) {
        week.completedIssues += 1;
        week.completedPoints += estimate ?? 0;
      }
    }
    return {
      date: utcDate(cutoff),
      ...week,
      scopePoints: round(week.scopePoints),
      completedPoints: round(week.completedPoints),
    };
  });
}
