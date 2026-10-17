import type { MockDb } from '../db.ts';
import { notFound, ok, type MockRequest, type MockRoute } from '../types.ts';
import {
  categoryOf,
  DAY,
  dayCutoffs,
  isDone,
  isoDay,
  points,
  reportContext,
  round,
  seeded,
  sprintRows,
  STATUS_LIST,
  type ReportContext,
} from './work-reports-data.ts';
import { reportMoreRoutes } from './work-reports-more.ts';
import type { Row } from './work-state.ts';

/*
 * The Reports screen in the mock backend and the public demo, on the server's paths: a
 * sprint's report, the project's flow, the control chart and time in status. The shapes
 * follow modules/work/shared/reports.ts; the history behind them is a seeded walk over the
 * demo's own issues, since the mock keeps no issue history.
 */

const W = '/api/v1/work';
const days = (request: MockRequest, fallback: number) =>
  Math.min(365, Math.max(7, Number(request.query.get('days') ?? fallback) || fallback));

const brief = (issue: Row) => ({
  issueId: issue.id,
  key: String(issue['key']),
  title: String(issue['title']),
  estimate: issue['estimate'] === null || issue['estimate'] === undefined ? null : points(issue),
});

/**
 * The demo keeps one closed sprint; a velocity chart needs a run of them, so the sprints
 * before it are made up here, named in the same series.
 */
function earlierSprints(sprint: Row, count: number): Row[] {
  const series = /^(.*?)(\d+)$/.exec(String(sprint['name']));
  const prefix = series?.[1] ?? 'Sprint ';
  const first = Number(series?.[2] ?? 10) - count - 1;
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const hex = Math.floor(seeded(`${sprint.id}-${index}`)() * 0xffffffffffff)
      .toString(16)
      .padStart(12, '0');
    return { id: `018f0000-0000-7000-8000-${hex.slice(0, 12)}`, name: `${prefix}${first + index}` };
  });
}

function sprintReport(db: MockDb, sprint: Row) {
  const context = reportContext(db, String(sprint['projectId']));
  if (!context) return null;
  const random = seeded(sprint.id);
  const start = Date.parse(String(sprint['startedAt']));
  const end = sprint['closedAt'] ? Date.parse(String(sprint['closedAt'])) : context.now;
  let members = context.issues.filter((issue) => issue['sprintId'] === sprint.id);
  if (members.length === 0) {
    members = context.issues.filter(() => random() < 0.3).slice(0, 9);
  }
  const closed = sprint['state'] === 'closed';
  const finished = members.filter((issue) => (closed ? random() < 0.8 : isDone(issue)));
  const open = members.filter((issue) => !finished.includes(issue));
  const added = members.filter(() => random() < 0.2).slice(0, 2);
  const removed = context.issues
    .filter((issue) => !members.includes(issue) && issue['sprintId'] === null)
    .slice(0, 1);
  const cutoffs = start < end ? dayCutoffs(end, Math.max(1, Math.ceil((end - start) / DAY))) : [];
  const total = members.reduce((sum, issue) => sum + points(issue), 0);
  const addedPoints = added.reduce((sum, issue) => sum + points(issue), 0);
  const removedPoints = removed.reduce((sum, issue) => sum + points(issue), 0);
  const donePoints = finished.reduce((sum, issue) => sum + points(issue), 0);
  const span = Math.max(1, cutoffs.length - 1);
  let completed = 0;
  const burnup = cutoffs.map((_, index) => {
    const share = index / span;
    const scope = total + (share < 0.3 ? removedPoints - addedPoints : 0);
    const target = donePoints * Math.min(1, share * (0.8 + random() * 0.4));
    completed = Math.min(scope, Math.max(completed, round(target, 0)));
    return { date: isoDay(cutoffs[index] ?? end), scopePoints: scope, completedPoints: completed };
  });
  const closedSprints = sprintRows(db)
    .filter((row) => row['projectId'] === sprint['projectId'] && row['state'] === 'closed')
    .slice(-6);
  const velocity = [...earlierSprints(sprint, 5 - closedSprints.length), ...closedSprints].map(
    (row) => {
      const pick = seeded(`velocity-${row.id}`);
      const committed = 18 + Math.round(pick() * 12);
      return {
        sprintId: row.id,
        name: String(row['name']),
        committedPoints: committed,
        completedPoints: Math.round(committed * (0.7 + pick() * 0.3)),
      };
    },
  );
  return {
    sprint,
    burndown: burnup.map((point) => ({
      date: point.date,
      remainingPoints: Math.max(0, point.scopePoints - point.completedPoints),
    })),
    burnup,
    velocity,
    scope: {
      completed: finished.map(brief),
      notCompleted: open.map(brief),
      added: added.map(brief),
      removed: removed.map(brief),
    },
  };
}

function flowReport(context: ReportContext, count: number) {
  const random = seeded(`flow-${context.key}`);
  const now = { todo: 0, inProgress: 0, done: 0 };
  for (const issue of context.issues) {
    const category = categoryOf(issue['statusId']);
    if (category === 'done') now.done += 1;
    else if (category === 'in_progress') now.inProgress += 1;
    else now.todo += 1;
  }
  const cutoffs = dayCutoffs(context.now, count);
  // Walk back from today: each earlier day had fewer issues and fewer of them done.
  let { todo, inProgress, done } = now;
  const rows = [];
  for (let index = cutoffs.length - 1; index >= 0; index -= 1) {
    const created = random() < 0.55 ? 1 + Math.floor(random() * 2) : 0;
    const resolved = done > 0 && random() < 0.5 ? 1 + Math.floor(random() * 2) : 0;
    rows.push({
      date: isoDay(cutoffs[index] ?? context.now),
      todo,
      inProgress,
      done,
      created,
      resolved,
    });
    done = Math.max(0, done - resolved);
    inProgress = Math.max(0, inProgress + resolved - (random() < 0.4 ? 1 : 0));
    todo = Math.max(0, todo - created + (random() < 0.4 ? 1 : 0));
  }
  return { projectId: context.project.id, days: rows.reverse() };
}

function controlChart(context: ReportContext, count: number) {
  const random = seeded(`control-${context.key}`);
  const from = Date.parse(`${isoDay(context.now - (count - 1) * DAY)}T00:00:00Z`);
  const finished = context.issues.filter(isDone);
  const pool = finished.length >= 8 ? finished : context.issues;
  const points = pool
    .slice(0, Math.min(pool.length, Math.round(count / 2) + 6))
    .map((issue) => ({
      issueId: issue.id,
      key: String(issue['key']),
      title: String(issue['title']),
      completedAt: new Date(from + random() * (context.now - from)).toISOString(),
      cycleDays: round(0.5 + random() * random() * 11),
    }))
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const sorted = points.map((point) => point.cycleDays).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return {
    from: isoDay(from),
    to: isoDay(context.now),
    points,
    meanDays: sorted.length ? round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
    medianDays: sorted.length ? round(median ?? 0) : null,
  };
}

const TYPICAL_DAYS: Record<string, number> = {
  Backlog: 6.4,
  Selected: 2.2,
  'In progress': 2.9,
  'Code review': 1.2,
  'Design review': 0.9,
  Testing: 1.5,
  Done: 8.7,
};

function timeInStatus(context: ReportContext, count: number) {
  const random = seeded(`time-${context.key}`);
  const statuses = STATUS_LIST.flatMap((status) => {
    const typical = TYPICAL_DAYS[status.name];
    if (typical === undefined) return [];
    const issues = Math.max(
      1,
      context.issues.filter((issue) => issue['statusId'] === status.id).length +
        Math.floor(random() * 6),
    );
    return [
      {
        statusId: status.id,
        name: status.name,
        category: status.category,
        averageDays: round(typical * (0.8 + random() * 0.4)),
        issues,
      },
    ];
  });
  return { from: isoDay(context.now - (count - 1) * DAY), to: isoDay(context.now), statuses };
}

const projectRoute = (
  path: string,
  build: (context: ReportContext, request: MockRequest, db: MockDb) => unknown,
): MockRoute => ({
  method: 'GET',
  pattern: `${W}/projects/:key/reports/${path}`,
  handle: (request, db) => {
    const context = reportContext(db, request.params['key']);
    return context ? ok(build(context, request, db)) : notFound('Project');
  },
});

export const workReportRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: `${W}/sprints/:id/report`,
    handle: (request, db) => {
      const sprint = sprintRows(db).find((row) => row.id === request.params['id']);
      const report = sprint && sprint['startedAt'] ? sprintReport(db, sprint) : null;
      return report ? ok(report) : notFound('Sprint');
    },
  },
  projectRoute('flow', (context, request) => flowReport(context, days(request, 30))),
  projectRoute('control', (context, request) => controlChart(context, days(request, 90))),
  projectRoute('time-in-status', (context, request) => timeInStatus(context, days(request, 90))),
  ...reportMoreRoutes(projectRoute),
];
