import type { RequestContext } from '@bemmoly/core';
import { ForbiddenError, NotFoundError } from '@bemmoly/shared';
import type { CreateWorkLogBody, Watcher, WorkLog } from '../../../../shared/activity.ts';
import type { Issue } from '../../../../shared/issues.ts';
import {
  actorUserId,
  iso,
  projectResource,
  requireDatabase,
  type IssueServiceDeps,
} from './deps.ts';
import { publishIssueChange } from './notify.ts';
import { loadIssueByKey, toIssue } from './rows.ts';
import { updateIssue } from './update.ts';

/*
 * The people around an issue: who it is assigned to, who watches it and who
 * logged time on it. Assigning is an update of one field, so it keeps the
 * history row and the notification the update path already writes.
 */

interface WatcherRow {
  id: string;
  target_id: string;
  user_id: string;
  created_at: Date | string;
}

interface WorkLogRow {
  id: string;
  issue_id: string;
  user_id: string;
  minutes: number;
  started_at: Date | string;
  note: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const toWatcher = (row: WatcherRow): Watcher => ({
  id: row.id,
  targetKind: 'issue',
  targetId: row.target_id,
  userId: row.user_id,
  createdAt: iso(row.created_at),
});

const toWorkLog = (row: WorkLogRow): WorkLog => ({
  id: row.id,
  issueId: row.issue_id,
  userId: row.user_id,
  minutes: row.minutes,
  startedAt: iso(row.started_at),
  note: row.note,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

const person = (ctx: RequestContext): string => {
  const userId = actorUserId(ctx);
  if (!userId) throw new ForbiddenError('Only a person can watch or log time');
  return userId;
};

export function assignIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  assigneeId: string | null,
): Promise<Issue> {
  return updateIssue(deps, ctx, key, { assigneeId });
}

export async function listWatchers(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<Watcher[]> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
  const rows = await sql<WatcherRow[]>`
    select id, target_id, user_id, created_at from watchers
    where target_kind = 'issue' and target_id = ${row.id} order by id`;
  return rows.map(toWatcher);
}

export async function watchIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  watching: boolean,
): Promise<void> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
  const userId = person(ctx);
  await sql.begin(async (tx) => {
    if (watching) {
      await tx`
        insert into watchers (target_kind, target_id, user_id) values ('issue', ${row.id}, ${userId})
        on conflict do nothing`;
    } else {
      await tx`
        delete from watchers
        where target_kind = 'issue' and target_id = ${row.id} and user_id = ${userId}`;
    }
    await publishIssueChange(deps, tx, toIssue(row));
  });
}

export async function listWorkLogs(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<WorkLog[]> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
  const rows = await sql<WorkLogRow[]>`
    select id, issue_id, user_id, minutes, started_at, note, created_at, updated_at
    from work_logs where issue_id = ${row.id} order by started_at desc, id desc`;
  return rows.map(toWorkLog);
}

export async function addWorkLog(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  body: CreateWorkLogBody,
): Promise<WorkLog> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(row.project_id));
  const userId = person(ctx);
  const created = await sql.begin(async (tx) => {
    const [log] = await tx<WorkLogRow[]>`
      insert into work_logs (issue_id, user_id, minutes, started_at, note)
      values (${row.id}, ${userId}, ${body.minutes},
        ${body.startedAt ?? new Date().toISOString()}::timestamptz, ${body.note ?? null})
      returning id, issue_id, user_id, minutes, started_at, note, created_at, updated_at`;
    if (!log) throw new NotFoundError('The work log was not stored');
    await publishIssueChange(deps, tx, toIssue(row));
    return toWorkLog(log);
  });
  return created as WorkLog;
}
