import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { IssueAssignee, SetAssigneesBody } from '../../../../shared/issues.ts';
import { projectResource, requireDatabase, type IssueServiceDeps } from './deps.ts';
import { notify, publishIssueChange } from './notify.ts';
import { loadIssueByKey, toIssue } from './rows.ts';
import { updateIssue } from './update.ts';

/*
 * The primary assignee still lives on issues.assignee_id, so changing it goes through the
 * update path and keeps its history row and notification; the trigger from 0030 opens and
 * closes the matching stint. The co-assignees are then reconciled against the same list, which
 * also reopens a stint the trigger closed when the old primary stays on as a co-assignee.
 * Each person newly on the issue gets the assignment notification.
 */

async function listAssignees(sql: SqlExecutor, issueId: string): Promise<IssueAssignee[]> {
  return sql<IssueAssignee[]>`
    select u.id, u.name, u.email
    from issue_assignees a
    join users u on u.id = a.user_id
    join issues i on i.id = a.issue_id
    where a.issue_id = ${issueId} and a.removed_at is null
    order by u.id is distinct from i.assignee_id, a.added_at, a.id`;
}

async function assertUsersExist(sql: SqlExecutor, userIds: readonly string[]): Promise<void> {
  if (userIds.length === 0) return;
  const rows = await sql<{ id: string }[]>`
    select id from users where id = any(${userIds as string[]}::uuid[])`;
  if (rows.length === userIds.length) return;
  throw new ValidationError('An assignee is not a user', {
    details: { assigneeIds: userIds.filter((id) => !rows.some((row) => row.id === id)) },
  });
}

export async function getAssignees(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<IssueAssignee[]> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
  return listAssignees(sql, row.id);
}

export async function setAssignees(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
  body: SetAssigneesBody,
): Promise<IssueAssignee[]> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key);
  await ctx.authz.authorize(ctx.actor, 'work.issue.edit', projectResource(row.project_id));
  const ids = body.assigneeIds;
  await assertUsersExist(sql, ids);
  const primary = ids[0] ?? null;
  if (primary !== row.assignee_id) await updateIssue(deps, ctx, key, { assigneeId: primary });
  return sql.begin(async (tx) => {
    const locked = await loadIssueByKey(tx, key, { lock: true });
    await tx`
      update issue_assignees set removed_at = now()
      where issue_id = ${locked.id} and removed_at is null
        and not (user_id = any(${ids}::uuid[]))`;
    const added = await tx<{ user_id: string }[]>`
      insert into issue_assignees (issue_id, user_id)
      select ${locked.id}, unnest(${ids}::uuid[])
      on conflict (issue_id, user_id) where removed_at is null do nothing
      returning user_id`;
    // The primary heard from the update path; the rest hear here, once per stint.
    const others = added.map((row) => row.user_id).filter((id) => id !== primary);
    const issue = toIssue(locked);
    if (others.length > 0) {
      await notify(deps, ctx, tx, issue, {
        kind: 'assignment',
        recipientIds: others,
        body: issue.title,
        dedupeKey: `issue:${issue.id}:assigned:${others.join(',')}:${issue.updatedAt}`,
      });
    }
    await publishIssueChange(deps, tx, issue, {
      board: true,
      sprintIds: [locked.sprint_id],
    });
    return listAssignees(tx, locked.id);
  });
}
