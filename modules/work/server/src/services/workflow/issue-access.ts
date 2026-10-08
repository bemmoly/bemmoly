import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type { WorkflowIssue } from './contract.ts';
import type { IssueReads, IssueWrites, PostActionField } from './deps.ts';

/*
 * The only SQL the workflow runs against issues. It reads rows generically
 * and writes status, assignee, sprint and resolution with a history row
 * each, so it never imports the issues service and the two can ship apart.
 */

const count = async (rows: { count: number | string }[]) => Number(rows[0]?.count ?? 0);

export const issueReads: IssueReads = {
  async openSubtasks(sql, issueId) {
    return count(
      await sql<{ count: string }[]>`
        select count(*) as count
        from issues i
        join issue_types t on t.id = i.type_id
        join workflow_statuses s on s.id = i.status_id
        where i.parent_id = ${issueId} and i.deleted_at is null
          and t.level = 'subtask' and s.category <> 'done'`,
    );
  },
  async unresolvedLinkedIssues(sql, issueId) {
    return count(
      await sql<{ count: string }[]>`
        select count(*) as count
        from issue_links l
        join issues i on i.id = l.source_id
        join workflow_statuses s on s.id = i.status_id
        where l.target_id = ${issueId} and l.kind = 'blocks'
          and i.deleted_at is null and s.category <> 'done'`,
    );
  },
};

const COLUMNS: Record<PostActionField, string> = {
  assignee_id: 'assignee',
  sprint_id: 'sprint',
  resolved_at: 'resolved_at',
};

export const issueWrites: IssueWrites = {
  async setField(sql, issueId, actorId, field, value) {
    const [before] = await sql<{ previous: string | null }[]>`
      select ${sql(field)}::text as previous from issues where id = ${issueId} for update`;
    if (!before) throw new NotFoundError('The issue was not found');
    await sql`
      update issues set ${sql(field)} = ${value}, updated_at = now() where id = ${issueId}`;
    await sql`
      insert into issue_history (issue_id, actor_id, field, from_value, to_value)
      values (${issueId}, ${actorId}, ${COLUMNS[field]},
        ${JSON.stringify(before.previous)}::jsonb, ${JSON.stringify(value)}::jsonb)`;
  },
};

export async function loadIssueByKey(sql: SqlExecutor, key: string): Promise<WorkflowIssue> {
  const [row] = await sql<WorkflowIssue[]>`
    select id, key, project_id, type_id, status_id, assignee_id, reporter_id, sprint_id,
      estimate, resolved_at, custom_fields
    from issues where key = ${key} and deleted_at is null`;
  if (!row) throw new NotFoundError(`Issue ${key} was not found`);
  return row;
}

/** Issue ids per status, for the publish body's status mapping check. */
export async function countIssuesByStatus(
  sql: SqlExecutor,
  statusIds: readonly string[],
): Promise<Map<string, number>> {
  if (statusIds.length === 0) return new Map();
  const rows = await sql<{ status_id: string; count: string }[]>`
    select status_id, count(*) as count from issues
    where status_id in ${sql([...statusIds])} and deleted_at is null
    group by status_id`;
  return new Map(rows.map((row) => [row.status_id, Number(row.count)]));
}

/**
 * Moves every issue in one status to another with a history row each, as
 * publish does for a removed status. Runs inside the publish transaction.
 */
export async function moveIssuesStatus(
  sql: SqlExecutor,
  fromStatusId: string,
  toStatusId: string,
  actorId: string | null,
): Promise<number> {
  const moved = await sql<{ id: string }[]>`
    update issues
    set status_id = ${toStatusId}, status_changed_at = now(), updated_at = now()
    where status_id = ${fromStatusId}
    returning id`;
  if (moved.length === 0) return 0;
  await sql`
    insert into issue_history (issue_id, actor_id, field, from_value, to_value)
    select id, ${actorId}, 'status', ${JSON.stringify(fromStatusId)}::jsonb,
      ${JSON.stringify(toStatusId)}::jsonb
    from issues where id in ${sql(moved.map((row) => row.id))}`;
  return moved.length;
}

/** The role the actor holds in the project, else their org role; null for non-people. */
export async function loadActorRoleId(
  sql: SqlExecutor,
  userId: string | null,
  projectId: string,
): Promise<string | null> {
  if (!userId) return null;
  const [row] = await sql<{ role_id: string }[]>`
    select coalesce(pm.role_id, u.role_id) as role_id
    from users u
    left join project_members pm on pm.user_id = u.id and pm.project_id = ${projectId}
    where u.id = ${userId}`;
  return row?.role_id ?? null;
}
