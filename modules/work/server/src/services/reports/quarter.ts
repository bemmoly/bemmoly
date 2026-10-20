import type {
  QuarterEpic,
  QuarterRef,
  QuarterReport,
  QuarterSprint,
  QuarterWeek,
} from '../../../../shared/quarter.ts';
import { quarterBounds } from '../../../../shared/quarter.ts';
import { utcDate } from '../metrics/burndown.ts';

/*
 * The quarter view's arithmetic over plain rows. Scope at a week's end is the work open when
 * the quarter began plus what was created since; completed is what entered done inside the
 * quarter and is done now, read from resolved_at, so an issue reopened and finished again
 * counts once, on its last finish.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const round = (value: number) => Math.round(value * 100) / 100;

export interface QuarterIssue {
  id: string;
  parentId: string | null;
  points: number;
  createdAt: number;
  resolvedAt: number | null;
  deletedAt: number | null;
  /** In a done status now. */
  done: boolean;
}

export interface QuarterSprintRow {
  id: string;
  name: string;
  state: QuarterSprint['state'];
  startsAt: number | null;
  endsAt: number | null;
  startedAt: number | null;
  closedAt: number | null;
  /** From the completion snapshot, for a closed sprint. */
  snapshot: { committedPoints: number; completedPoints: number } | null;
  /** The live points of its issues, for a sprint still open. */
  points: number;
  donePoints: number;
}

export interface QuarterEpicRow {
  id: string;
  key: string;
  title: string;
  done: boolean;
  createdAt: number;
}

export interface QuarterInput {
  quarter: QuarterRef;
  now: number;
  issues: readonly QuarterIssue[];
  sprints: readonly QuarterSprintRow[];
  epics: readonly QuarterEpicRow[];
}

/** Week ends from the quarter's start, the last one cut short at now or the quarter's end. */
export function quarterCutoffs(start: number, end: number, now: number): number[] {
  const until = Math.min(end, now);
  if (until <= start) return [];
  const cutoffs: number[] = [];
  for (let at = start + WEEK; at < until; at += WEEK) cutoffs.push(at);
  cutoffs.push(until);
  return cutoffs;
}

const finishedIn = (issue: QuarterIssue, start: number, before: number) =>
  issue.done && issue.resolvedAt !== null && issue.resolvedAt >= start && issue.resolvedAt < before;

/** In the quarter's scope at `at`: alive then, and not already finished before it began. */
const inScope = (issue: QuarterIssue, start: number, at: number) =>
  issue.createdAt < at &&
  (issue.deletedAt === null || issue.deletedAt >= at) &&
  !(issue.done && issue.resolvedAt !== null && issue.resolvedAt < start);

export function quarterWeeks(
  issues: readonly QuarterIssue[],
  start: number,
  cutoffs: readonly number[],
): QuarterWeek[] {
  return cutoffs.map((at) => {
    const scope = issues.filter((issue) => inScope(issue, start, at));
    const completed = scope.filter((issue) => finishedIn(issue, start, at));
    const sum = (list: QuarterIssue[]) => round(list.reduce((total, i) => total + i.points, 0));
    return {
      date: utcDate(at - 1),
      scopeIssues: scope.length,
      completedIssues: completed.length,
      scopePoints: sum(scope),
      completedPoints: sum(completed),
    };
  });
}

/** Sprints that ran, or are planned to run, inside the quarter, in date order. */
export function quarterSprints(
  sprints: readonly QuarterSprintRow[],
  start: number,
  end: number,
  now: number,
): QuarterSprint[] {
  return sprints
    .flatMap((sprint) => {
      const from = sprint.startedAt ?? sprint.startsAt;
      if (from === null) return [];
      const to =
        sprint.closedAt ??
        sprint.endsAt ??
        (sprint.state === 'active' ? Math.max(now, from) : from);
      if (from >= end || to < start) return [];
      const closed = sprint.state === 'closed' && sprint.snapshot;
      return [
        {
          from,
          row: {
            sprintId: sprint.id,
            name: sprint.name,
            state: sprint.state,
            from: utcDate(from),
            to: (sprint.closedAt ?? sprint.endsAt) ? utcDate(to) : null,
            committedPoints: round(closed ? sprint.snapshot!.committedPoints : sprint.points),
            completedPoints: round(closed ? sprint.snapshot!.completedPoints : sprint.donePoints),
          },
        },
      ];
    })
    .sort((a, b) => a.from - b.from)
    .map((entry) => entry.row);
}

/** Epics with work in the quarter's scope, open ones first, then by what they finished. */
export function quarterEpics(
  epics: readonly QuarterEpicRow[],
  issues: readonly QuarterIssue[],
  start: number,
  end: number,
  at: number,
): QuarterEpic[] {
  return epics
    .filter((epic) => epic.createdAt < end)
    .flatMap((epic) => {
      const children = issues.filter(
        (issue) => issue.parentId === epic.id && issue.deletedAt === null,
      );
      const live = children.filter((issue) => inScope(issue, start, at));
      if (live.length === 0 && epic.done) return [];
      const done = children.filter((issue) => issue.done);
      const points = (list: QuarterIssue[]) => round(list.reduce((sum, i) => sum + i.points, 0));
      return [
        {
          epicId: epic.id,
          key: epic.key,
          title: epic.title,
          done: epic.done,
          issues: children.length,
          doneIssues: done.length,
          points: points(children),
          donePoints: points(done),
          completedInQuarter: children.filter((issue) => finishedIn(issue, start, end)).length,
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        b.completedInQuarter - a.completedInQuarter ||
        a.key.localeCompare(b.key, undefined, { numeric: true }),
    );
}

export function quarterReport(input: QuarterInput): QuarterReport {
  const { start, end } = quarterBounds(input.quarter);
  const cutoffs = quarterCutoffs(start, end, input.now);
  const at = Math.min(end, Math.max(start, input.now));
  return {
    quarter: input.quarter,
    from: utcDate(start),
    to: utcDate(end - 1),
    elapsed: round((at - start) / (end - start)),
    sprints: quarterSprints(input.sprints, start, end, input.now),
    epics: quarterEpics(input.epics, input.issues, start, end, at),
    weeks: quarterWeeks(input.issues, start, cutoffs),
  };
}
