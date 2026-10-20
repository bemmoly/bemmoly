import type { MockDb } from '../db.ts';
import type { MockRequest } from '../types.ts';
import {
  epicTypeIds,
  isDone,
  isoDay,
  points,
  round,
  seeded,
  sprintRows,
  WEEK,
  type ReportContext,
} from './work-reports-data.ts';

/*
 * The quarter view in the mock backend, on the server's path and in the shape of
 * modules/work/shared/quarter.ts. The demo's done issues mostly carry no finish time, so each
 * is given a seeded one inside the quarter so far, and the burnup climbs the same way on
 * every visit.
 */

const QUARTER = /^(\d{4})-Q([1-4])$/;

function bounds(ref: string) {
  const [, year, q] = QUARTER.exec(ref) ?? [];
  const start = Date.UTC(Number(year), (Number(q) - 1) * 3, 1);
  return { start, end: Date.UTC(Number(year), Number(q) * 3, 1) };
}

const current = (now: number) => {
  const date = new Date(now);
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
};

const time = (value: unknown) => (value ? Date.parse(String(value)) : null);

export function quarterReport(context: ReportContext, request: MockRequest, db: MockDb) {
  const asked = request.query.get('quarter') ?? '';
  const quarter = QUARTER.test(asked) ? asked : current(context.now);
  const { start, end } = bounds(quarter);
  const until = Math.min(end, context.now);
  const epics = epicTypeIds(db);
  const work = context.issues
    .filter((issue) => !epics.has(String(issue['typeId'])))
    .map((issue) => {
      const random = seeded(`${issue.id}-${quarter}`);
      const created = time(issue['createdAt']) ?? start;
      const resolved = isDone(issue)
        ? (time(issue['resolvedAt']) ?? start + random() * Math.max(1, until - start))
        : null;
      return { issue, created: Math.min(created, start + random() * WEEK), resolved };
    });
  const inScope = (item: (typeof work)[number], at: number) =>
    item.created < at && !(item.resolved !== null && item.resolved < start);
  const finished = (item: (typeof work)[number], at: number) =>
    item.resolved !== null && item.resolved >= start && item.resolved < at;

  const cutoffs: number[] = [];
  if (until > start) {
    for (let at = start + WEEK; at < until; at += WEEK) cutoffs.push(at);
    cutoffs.push(until);
  }
  const weeks = cutoffs.map((at) => {
    const scope = work.filter((item) => inScope(item, at));
    const done = scope.filter((item) => finished(item, at));
    const sum = (list: typeof work) =>
      round(
        list.reduce((t, i) => t + points(i.issue), 0),
        2,
      );
    return {
      date: isoDay(at - 1),
      scopeIssues: scope.length,
      completedIssues: done.length,
      scopePoints: sum(scope),
      completedPoints: sum(done),
    };
  });

  const sprints = sprintRows(db)
    .filter((sprint) => sprint['projectId'] === context.project.id)
    .flatMap((sprint) => {
      const from = time(sprint['startedAt']) ?? time(sprint['startsAt']);
      if (from === null) return [];
      const to = time(sprint['closedAt']) ?? time(sprint['endsAt']) ?? context.now;
      if (from >= end || to < start) return [];
      const members = context.issues.filter((issue) => issue['sprintId'] === sprint.id);
      const total = members.reduce((sum, issue) => sum + points(issue), 0);
      const done = members.filter(isDone).reduce((sum, issue) => sum + points(issue), 0);
      return [
        {
          sprintId: sprint.id,
          name: String(sprint['name']),
          state: sprint['state'],
          from: isoDay(from),
          to: sprint['closedAt'] || sprint['endsAt'] ? isoDay(to) : null,
          committedPoints: total,
          completedPoints: done,
        },
      ];
    });

  const epicRows = context.issues
    .filter((issue) => epics.has(String(issue['typeId'])))
    .flatMap((epic) => {
      const children = work.filter((item) => item.issue['parentId'] === epic.id);
      if (children.length === 0 && isDone(epic)) return [];
      const done = children.filter((item) => isDone(item.issue));
      const sum = (list: typeof work) => list.reduce((t, i) => t + points(i.issue), 0);
      return [
        {
          epicId: epic.id,
          key: String(epic['key']),
          title: String(epic['title']),
          done: isDone(epic),
          issues: children.length,
          doneIssues: done.length,
          points: sum(children),
          donePoints: sum(done),
          completedInQuarter: children.filter((item) => finished(item, end)).length,
        },
      ];
    })
    .sort((a, b) => Number(a.done) - Number(b.done) || b.completedInQuarter - a.completedInQuarter);

  const at = Math.min(end, Math.max(start, context.now));
  return {
    quarter,
    from: isoDay(start),
    to: isoDay(end - 1),
    elapsed: round((at - start) / (end - start), 2),
    sprints,
    epics: epicRows,
    weeks,
  };
}
