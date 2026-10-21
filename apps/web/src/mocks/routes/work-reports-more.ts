import type { MockDb } from '../db.ts';
import type { MockRequest, MockRoute } from '../types.ts';
import { issueStore } from './work-issue-store.ts';
import {
  categoryOf,
  DAY,
  epicTypeIds,
  isDone,
  isoDay,
  points,
  seeded,
  sprintRows,
  STATUS_LIST,
  userName,
  versionOf,
  versionRows,
  WEEK,
  type ReportContext,
} from './work-reports-data.ts';
import { quarterReport } from './work-quarter.ts';
import { workState, type Row } from './work-state.ts';

/*
 * The rest of the Reports mock: an epic's or version's burnup, field statistics and time
 * tracking. Statistics count the demo's real issues; the burnups and logged time are seeded.
 */

type ProjectRoute = (
  path: string,
  build: (context: ReportContext, request: MockRequest, db: MockDb) => unknown,
) => MockRoute;

interface Bucket {
  id: string | null;
  label: string;
}

const PRIORITIES = ['highest', 'high', 'medium', 'low', 'lowest'];
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function scopeReport(context: ReportContext, request: MockRequest, db: MockDb) {
  const kind = request.query.get('kind') === 'version' ? 'version' : 'epic';
  const weeks = Math.min(52, Math.max(4, Number(request.query.get('weeks') ?? 12) || 12));
  const epics = epicTypeIds(db);
  const versions = versionRows(db, context.key);
  const targets =
    kind === 'epic'
      ? context.issues
          .filter((issue) => epics.has(String(issue['typeId'])))
          .map((issue) => ({
            id: issue.id,
            label: `${String(issue['key'])} ${String(issue['title'])}`,
            done: isDone(issue),
          }))
      : versions.map((row) => ({
          id: row.id,
          label: String(row['name']),
          done: row['status'] === 'released',
        }));
  const ordered = [...targets.filter((t) => !t.done), ...targets.filter((t) => t.done)];
  const target = ordered.find((item) => item.id === request.query.get('id')) ?? ordered[0] ?? null;
  if (!target) return { kind, targets: ordered, target: null, weeks: [] };
  let members =
    kind === 'epic'
      ? context.issues.filter((issue) => issue['parentId'] === target.id)
      : context.issues.filter((issue) => versionOf(issue, versions)?.id === target.id);
  if (members.length === 0)
    members = context.issues.filter((issue) => !epics.has(String(issue['typeId']))).slice(0, 6);
  const random = seeded(`scope-${target.id}`);
  const scope = members.reduce((sum, issue) => sum + points(issue), 0);
  const scopeIssues = members.length;
  const done = members.filter(isDone);
  const donePoints = done.reduce((sum, issue) => sum + points(issue), 0) || Math.round(scope * 0.4);
  return {
    kind,
    targets: ordered,
    target,
    weeks: Array.from({ length: weeks }, (_, index) => {
      const share = (index + 1) / weeks;
      const grown = Math.min(1, 0.55 + share * 0.5 + random() * 0.05);
      const progress = Math.max(0, share * share * (0.9 + random() * 0.2));
      const scopePoints = Math.round(scope * grown);
      return {
        date: isoDay(context.now - (weeks - 1 - index) * WEEK),
        scopePoints,
        completedPoints: Math.min(scopePoints, Math.round(donePoints * Math.min(1, progress))),
        scopeIssues: Math.max(1, Math.round(scopeIssues * grown)),
        completedIssues: Math.min(scopeIssues, Math.round(done.length * Math.min(1, progress))),
      };
    }),
  };
}

function bucketsOf(field: string, issue: Row, db: MockDb, context: ReportContext): Bucket[] {
  const store = issueStore(db);
  switch (field) {
    case 'assignee':
      return [
        issue['assigneeId']
          ? { id: String(issue['assigneeId']), label: userName(db, issue['assigneeId']) }
          : { id: null, label: 'Unassigned' },
      ];
    case 'type': {
      const type = workState(db).issueTypes.find((row) => row.id === issue['typeId']);
      return [{ id: String(issue['typeId']), label: String(type?.['name'] ?? 'Unknown') }];
    }
    case 'priority':
      return [{ id: String(issue['priority']), label: capital(String(issue['priority'])) }];
    case 'label': {
      const ids = (issue['labelIds'] as string[] | undefined) ?? [];
      const labels = ids.map((id) => ({
        id,
        label: String(store.labels.find((row) => row.id === id)?.['name'] ?? id),
      }));
      return labels.length ? labels : [{ id: null, label: 'No label' }];
    }
    case 'epic': {
      const parent = context.issues.find((row) => row.id === issue['parentId']);
      return parent && epicTypeIds(db).has(String(parent['typeId']))
        ? [{ id: parent.id, label: `${String(parent['key'])} ${String(parent['title'])}` }]
        : [{ id: null, label: 'No epic' }];
    }
    case 'version': {
      const version = versionOf(issue, versionRows(db, context.key));
      return [
        version
          ? { id: version.id, label: String(version['name']) }
          : { id: null, label: 'No version' },
      ];
    }
    case 'component':
      return [{ id: null, label: 'No component' }];
    default: {
      const status = STATUS_LIST.find((row) => row.id === issue['statusId']);
      return [{ id: String(issue['statusId']), label: status?.name ?? 'Unknown' }];
    }
  }
}

function ordered(field: string, counts: Map<string | null, Bucket & { count: number }>) {
  const rows = [...counts.values()];
  const fixed =
    field === 'status' ? STATUS_LIST.map((s) => s.id) : field === 'priority' ? PRIORITIES : null;
  return rows.sort((a, b) => {
    if (a.id === null || b.id === null) return a.id === null ? 1 : -1;
    if (fixed) return fixed.indexOf(a.id) - fixed.indexOf(b.id);
    return b.count - a.count || a.label.localeCompare(b.label);
  });
}

function stats(context: ReportContext, request: MockRequest, db: MockDb) {
  const by = request.query.get('by') ?? 'status';
  const second = request.query.get('by2');
  const by2 = second && second !== by ? second : null;
  const rows = new Map<string | null, Bucket & { count: number }>();
  const columns = new Map<string | null, Bucket & { count: number }>();
  const cells = new Map<string, { row: string | null; column: string | null; count: number }>();
  for (const issue of context.issues) {
    const across = by2 ? bucketsOf(by2, issue, db, context) : [];
    for (const bucket of bucketsOf(by, issue, db, context)) {
      const row = rows.get(bucket.id) ?? { ...bucket, count: 0 };
      row.count += 1;
      rows.set(bucket.id, row);
      for (const column of across) {
        const entry = columns.get(column.id) ?? { ...column, count: 0 };
        entry.count += 1;
        columns.set(column.id, entry);
        const key = `${bucket.id}|${column.id}`;
        const cell = cells.get(key) ?? { row: bucket.id, column: column.id, count: 0 };
        cell.count += 1;
        cells.set(key, cell);
      }
    }
  }
  return {
    by,
    by2,
    rows: ordered(by, rows),
    ...(by2
      ? {
          columns: ordered(by2, columns).map(({ id, label }) => ({ id, label })),
          cells: [...cells.values()],
        }
      : {}),
    total: context.issues.length,
  };
}

function timeTracking(context: ReportContext, request: MockRequest, db: MockDb) {
  const sprint = sprintRows(db).find((row) => row.id === request.query.get('sprintId'));
  const count = Math.min(365, Math.max(7, Number(request.query.get('days') ?? 30) || 30));
  const end = sprint?.['closedAt'] ? Date.parse(String(sprint['closedAt'])) : context.now;
  const start = sprint?.['startedAt']
    ? Date.parse(String(sprint['startedAt']))
    : end - (count - 1) * DAY;
  const random = seeded(`time-tracking-${context.key}-${count}`);
  // Time goes on the work people have picked up; untouched backlog only when there is little else.
  const assigned = context.issues.filter((issue) => issue['assigneeId']);
  const started = assigned.filter((issue) => categoryOf(issue['statusId']) !== 'todo');
  const worked = started.length >= 4 ? started : assigned;
  const weeks = Math.max(1, Math.ceil((end - start + 1) / WEEK));
  const weekly = Array.from({ length: weeks }, (_, index) => ({
    date: isoDay(start + index * WEEK),
    minutes: Math.round((900 + random() * 1500) / 15) * 15,
  }));
  const totalMinutes = weekly.reduce((sum, week) => sum + week.minutes, 0);
  const issues = worked.slice(0, 12).map((issue) => ({ issue, share: 0.3 + random() }));
  const shareSum = issues.reduce((sum, item) => sum + item.share, 0) || 1;
  const perIssue = issues
    .map(({ issue, share }) => ({
      issueId: issue.id,
      key: String(issue['key']),
      title: String(issue['title']),
      estimate:
        issue['estimate'] === null || issue['estimate'] === undefined ? null : points(issue),
      minutes: Math.round((totalMinutes * share) / shareSum / 15) * 15,
      userId: String(issue['assigneeId']),
    }))
    .sort((a, b) => b.minutes - a.minutes || a.key.localeCompare(b.key));
  const people = new Map<string, number>();
  for (const item of perIssue)
    people.set(item.userId, (people.get(item.userId) ?? 0) + item.minutes);
  return {
    from: isoDay(start),
    to: isoDay(end),
    totalMinutes: perIssue.length ? perIssue.reduce((sum, item) => sum + item.minutes, 0) : 0,
    weeks: perIssue.length ? weekly : [],
    people: [...people]
      .map(([userId, minutes]) => ({ userId, name: userName(db, userId), minutes }))
      .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)),
    issues: perIssue.map(({ userId: _, ...issue }) => issue),
  };
}

export const reportMoreRoutes = (route: ProjectRoute): MockRoute[] => [
  route('scope', scopeReport),
  route('stats', stats),
  route('time-tracking', timeTracking),
  route('quarter', quarterReport),
];
