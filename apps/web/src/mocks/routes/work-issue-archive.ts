import { emit, type MockDb } from '../db.ts';
import { notFound, ok, type MockRoute } from '../types.ts';
import { touch, type Row } from './work-state.ts';

interface IssueAccess {
  issueOf(db: MockDb, key: string): Row | undefined;
  record(db: MockDb, issue: Row, field: string, from: unknown, to: unknown): void;
}

/**
 * POST /issues/:key/archive and /unarchive: set or clear archivedAt with a history row, as the
 * server does. Both are idempotent, so a second call changes nothing.
 */
export function issueArchiveRoutes({ issueOf, record }: IssueAccess): MockRoute[] {
  const route = (verb: string, archived: boolean): MockRoute => ({
    method: 'POST',
    pattern: `/api/v1/work/issues/:key/${verb}`,
    handle: (request, db) => {
      const issue = issueOf(db, request.params['key'] ?? '');
      if (!issue) return notFound('Issue');
      if (Boolean(issue['archivedAt']) !== archived) {
        record(db, issue, 'archived', archived ? null : true, archived ? true : null);
        touch(issue, { archivedAt: archived ? new Date().toISOString() : null });
        emit(db, 'work.issue.updated', [issue.id]);
      }
      return ok(issue);
    },
  });
  return [route('archive', true), route('unarchive', false)];
}
