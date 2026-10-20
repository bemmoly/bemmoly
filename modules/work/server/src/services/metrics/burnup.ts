import type { BurnupPoint, SprintReportIssue, SprintScope } from '../../../../shared/reports.ts';
import {
  dayCutoffs,
  newestFirstByIssue,
  stateAt,
  utcDate,
  type BurndownInput,
  type BurndownIssue,
} from './burndown.ts';

/*
 * The sprint report's other two views of the same history the burndown reads:
 * scope and completed points per day (the burnup), and which issues were
 * finished, left open, added after the start or taken out.
 */

export interface ReportIssue extends BurndownIssue {
  key: string;
  title: string;
}

export interface SprintReportInput extends BurndownInput {
  issues: readonly ReportIssue[];
}

const round = (points: number) => Math.round(points * 100) / 100;

export function burnup(input: BurndownInput): BurnupPoint[] {
  if (input.end < input.start) return [];
  const byIssue = newestFirstByIssue(input.changes);
  return dayCutoffs(input.start, input.end).map((cutoff) => {
    let scope = 0;
    let completed = 0;
    for (const issue of input.issues) {
      const state = stateAt(issue, byIssue.get(issue.id) ?? [], cutoff);
      if (!state || state.sprintId !== input.sprintId) continue;
      scope += state.estimate ?? 0;
      if (input.done.has(state.statusId)) completed += state.estimate ?? 0;
    }
    return { date: utcDate(cutoff), scopePoints: round(scope), completedPoints: round(completed) };
  });
}

const byKey = (a: SprintReportIssue, b: SprintReportIssue) =>
  a.key.localeCompare(b.key, undefined, { numeric: true });

/** `carriedIn` is the unfinished work earlier sprints handed this one, with its points then. */
export function sprintScope(
  input: SprintReportInput,
  carriedIn: ReadonlyMap<string, number | null> = new Map(),
): SprintScope {
  const scope: SprintScope = {
    completed: [],
    notCompleted: [],
    added: [],
    removed: [],
    carriedOver: [],
  };
  const byIssue = newestFirstByIssue(input.changes);
  for (const issue of input.issues) {
    const changes = byIssue.get(issue.id) ?? [];
    const atStart = stateAt(issue, changes, input.start);
    const atEnd = stateAt(issue, changes, input.end);
    const wasIn = atStart?.sprintId === input.sprintId;
    const isIn = atEnd?.sprintId === input.sprintId;
    const row = {
      issueId: issue.id,
      key: issue.key,
      title: issue.title,
      estimate: (isIn ? atEnd?.estimate : atStart?.estimate) ?? null,
    };
    if (isIn && atEnd && input.done.has(atEnd.statusId)) scope.completed.push(row);
    else if (isIn) scope.notCompleted.push(row);
    if (isIn && !wasIn) scope.added.push(row);
    if (wasIn && !isIn) scope.removed.push(row);
    if (wasIn && carriedIn.has(issue.id)) {
      scope.carriedOver.push({ ...row, estimate: carriedIn.get(issue.id) ?? null });
    }
  }
  for (const list of Object.values(scope)) list.sort(byKey);
  return scope;
}
