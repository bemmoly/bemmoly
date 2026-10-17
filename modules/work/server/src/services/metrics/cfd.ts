import type { FlowReportDay } from '../../../../shared/reports.ts';
import { utcDate } from './burndown.ts';

/*
 * The cumulative flow and created-against-resolved series. Each issue's
 * status at the end of a day is its current one with the later status
 * changes undone, the same rewind the burndown uses, so nothing is stored.
 */

const DAY = 24 * 60 * 60 * 1000;

export type Category = 'todo' | 'inProgress' | 'done';

export interface CfdIssue {
  id: string;
  statusId: string;
  createdAt: number;
  deletedAt: number | null;
}

export interface CfdStatusChange {
  issueId: string;
  from: string | null;
  to: string | null;
  at: number;
}

export interface CfdInput {
  issues: readonly CfdIssue[];
  /** Status changes of those issues since the first day began; any order. */
  changes: readonly CfdStatusChange[];
  done: ReadonlySet<string>;
  inProgress: ReadonlySet<string>;
  /** The last instant drawn; the series ends with its day. */
  now: number;
  days: number;
}

/** The end of each of the last `days` UTC days, the last one being now. */
export function reportCutoffs(now: number, days: number): number[] {
  const today = Date.parse(`${utcDate(now)}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, index) =>
    Math.min(today - (days - 1 - index) * DAY + DAY - 1, now),
  );
}

export function flowReportDays(input: CfdInput): FlowReportDay[] {
  const category = (statusId: string): Category =>
    input.done.has(statusId) ? 'done' : input.inProgress.has(statusId) ? 'inProgress' : 'todo';
  const newestFirst = [...input.changes].sort((a, b) => b.at - a.at);
  const cutoffs = reportCutoffs(input.now, input.days);
  const first = cutoffs[0] === undefined ? input.now : cutoffs[0] - DAY + 1;
  const dayOf = (at: number) => Math.floor((at - first) / DAY);

  const created = cutoffs.map(() => 0);
  const resolved = cutoffs.map(() => 0);
  for (const issue of input.issues) {
    const day = dayOf(issue.createdAt);
    if (day >= 0 && day < cutoffs.length) created[day] = (created[day] ?? 0) + 1;
  }
  for (const change of input.changes) {
    const day = dayOf(change.at);
    const into = change.to !== null && input.done.has(change.to);
    const fromOpen = change.from === null || !input.done.has(change.from);
    if (into && fromOpen && day >= 0 && day < cutoffs.length) {
      resolved[day] = (resolved[day] ?? 0) + 1;
    }
  }

  // Walk the days newest first, undoing each day's changes as the walk passes them.
  const status = new Map(input.issues.map((issue) => [issue.id, issue.statusId]));
  let next = 0;
  const result: FlowReportDay[] = [];
  for (let index = cutoffs.length - 1; index >= 0; index -= 1) {
    const cutoff = cutoffs[index] ?? input.now;
    while (next < newestFirst.length && (newestFirst[next]?.at ?? 0) > cutoff) {
      const change = newestFirst[next];
      if (change && change.from !== null) status.set(change.issueId, change.from);
      next += 1;
    }
    const counts = { todo: 0, inProgress: 0, done: 0 };
    for (const issue of input.issues) {
      if (issue.createdAt > cutoff) continue;
      if (issue.deletedAt !== null && issue.deletedAt <= cutoff) continue;
      counts[category(status.get(issue.id) ?? issue.statusId)] += 1;
    }
    result.push({
      date: utcDate(cutoff),
      ...counts,
      created: created[index] ?? 0,
      resolved: resolved[index] ?? 0,
    });
  }
  return result.reverse();
}
