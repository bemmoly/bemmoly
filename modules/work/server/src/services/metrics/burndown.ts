import type { BurndownPoint } from '../../../../shared/metrics.ts';

/*
 * A sprint's burndown rebuilt from issue history: each issue's state at the
 * end of every day is its current state with the later changes undone, so
 * scope added mid-sprint, re-estimates and reopened work all show where they
 * happened, without a nightly rollup.
 */

const DAY = 24 * 60 * 60 * 1000;

/** The longest series drawn; a sprint left open for months stops here. */
export const MAX_BURNDOWN_DAYS = 120;

export interface IssueState {
  sprintId: string | null;
  statusId: string;
  estimate: number | null;
}

export interface BurndownIssue extends IssueState {
  id: string;
  createdAt: number;
  deletedAt: number | null;
}

export type TrackedField = keyof IssueState;

export interface FieldChange {
  issueId: string;
  field: TrackedField;
  from: unknown;
  at: number;
}

export interface BurndownInput {
  sprintId: string;
  issues: readonly BurndownIssue[];
  /** Every change to a tracked field of those issues; any order. */
  changes: readonly FieldChange[];
  done: ReadonlySet<string>;
  /** When the sprint started; the first point is the end of that day. */
  start: number;
  /** The last instant drawn: now for an active sprint, just before close for a closed one. */
  end: number;
}

const asState = (field: TrackedField, value: unknown): IssueState[TrackedField] => {
  if (field === 'estimate') return value === null || value === undefined ? null : Number(value);
  if (field === 'sprintId') return typeof value === 'string' ? value : null;
  return typeof value === 'string' ? value : '';
};

/** An issue as it stood at `at`: every change after that instant is undone, newest first. */
export function stateAt(
  issue: BurndownIssue,
  newestFirst: readonly FieldChange[],
  at: number,
): IssueState | null {
  if (issue.createdAt > at) return null;
  if (issue.deletedAt !== null && issue.deletedAt <= at) return null;
  const state: IssueState = {
    sprintId: issue.sprintId,
    statusId: issue.statusId,
    estimate: issue.estimate,
  };
  for (const change of newestFirst) {
    if (change.at <= at) break;
    Object.assign(state, { [change.field]: asState(change.field, change.from) });
  }
  return state;
}

export const utcDate = (instant: number): string => new Date(instant).toISOString().slice(0, 10);

/** The cut-off of every day from the start's date to the end's, the last one being `end`. */
export function dayCutoffs(start: number, end: number): number[] {
  const cutoffs: number[] = [];
  const first = Date.parse(`${utcDate(start)}T00:00:00.000Z`);
  for (let day = first; day <= end && cutoffs.length < MAX_BURNDOWN_DAYS; day += DAY) {
    cutoffs.push(Math.min(day + DAY - 1, end));
  }
  return cutoffs;
}

export function burndown(input: BurndownInput): BurndownPoint[] {
  if (input.end < input.start) return [];
  const byIssue = new Map<string, FieldChange[]>();
  for (const change of input.changes) {
    const list = byIssue.get(change.issueId) ?? [];
    list.push(change);
    byIssue.set(change.issueId, list);
  }
  for (const list of byIssue.values()) list.sort((a, b) => b.at - a.at);
  return dayCutoffs(input.start, input.end).map((cutoff) => {
    let remaining = 0;
    for (const issue of input.issues) {
      const state = stateAt(issue, byIssue.get(issue.id) ?? [], cutoff);
      if (!state || state.sprintId !== input.sprintId || input.done.has(state.statusId)) continue;
      remaining += state.estimate ?? 0;
    }
    return { date: utcDate(cutoff), remainingPoints: Math.round(remaining * 100) / 100 };
  });
}
