import type { MockDb } from '../db.ts';
import { ok, type MockRoute } from '../types.ts';
import { statuses } from './work-issue-detail.ts';
import { issueStore } from './work-issue-store.ts';
import { watchersOf } from './work-issues.ts';
import { workState, type Row } from './work-state.ts';

/*
 * Home's "my work" on the in-memory backend, in the server's shape: the signed-in person's
 * assigned, reported and watched issues, newest change first, each list with its total.
 */

function present(db: MockDb, issue: Row) {
  const status = statuses(db).get(String(issue['statusId']));
  const type = workState(db).issueTypes.find((row) => row.id === issue['typeId']);
  return {
    id: issue.id,
    key: issue['key'],
    title: issue['title'],
    priority: issue['priority'],
    dueAt: issue['dueAt'] ?? null,
    updatedAt: issue['updatedAt'],
    status: {
      id: status?.id,
      name: status?.['name'],
      category: status?.['category'],
      color: status?.['color'] ?? null,
    },
    type: {
      id: type?.id,
      key: type?.['key'],
      name: type?.['name'],
      icon: type?.['icon'] ?? null,
      color: type?.['color'] ?? null,
    },
  };
}

function list(db: MockDb, rows: Row[], limit: number) {
  const sorted = [...rows].sort((a, b) =>
    String(b['updatedAt']).localeCompare(String(a['updatedAt'])),
  );
  return { items: sorted.slice(0, limit).map((row) => present(db, row)), total: rows.length };
}

export const workMyIssuesRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/work/my-issues',
    handle: (request, db) => {
      const me = db.signedInAs;
      const limit = Math.min(20, Math.max(1, Number(request.query.get('limit') ?? 6) || 6));
      const live = issueStore(db).issues.filter((row) => !row['deletedAt']);
      const watched = watchersOf(db);
      const assigned = live.filter((row) => row['assigneeId'] === me);
      const reported = live.filter((row) => row['reporterId'] === me);
      const watching = live.filter(
        (row) =>
          watched[row.id]?.includes(me ?? '') &&
          row['assigneeId'] !== me &&
          row['reporterId'] !== me,
      );
      return ok({
        assigned: list(db, assigned, limit),
        reported: list(db, reported, limit),
        watching: list(db, watching, limit),
      });
    },
  },
];
