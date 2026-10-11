import type { SqlExecutor } from '@bemmoly/core';

/*
 * The reads issueContext makes: one row for the issue with its field values named, its last
 * comments, its history since the last summary and its blockers. Dates arrive as strings
 * (the pool's drizzle parsers) and are bound as text.
 */

export interface IssueFacts {
  id: string;
  key: string;
  title: string;
  description: string;
  projectId: string;
  reporterId: string | null;
  type: string;
  status: string;
  statusCategory: string;
  priority: string;
  assignee: string | null;
  reporter: string | null;
  estimate: string | null;
  dueAt: string | null;
  sprint: string | null;
  parentKey: string | null;
  fixVersion: string | null;
  component: string | null;
  labels: string[];
  statusChangedAt: string;
  updatedAt: string;
}

export async function readIssueFacts(sql: SqlExecutor, id: string): Promise<IssueFacts | null> {
  const [row] = await sql<IssueFacts[]>`
    select i.id, i.key, i.title, i.description_text as description, i.project_id as "projectId",
      i.reporter_id as "reporterId", t.name as type, s.name as status,
      s.category as "statusCategory", i.priority, a.name as assignee, r.name as reporter,
      i.estimate::text as estimate, i.due_at::text as "dueAt", sp.name as sprint,
      p.key as "parentKey", v.name as "fixVersion", c.name as component,
      coalesce((select array_agg(l.name order by l.name) from issue_labels il
        join labels l on l.id = il.label_id where il.issue_id = i.id), '{}') as labels,
      i.status_changed_at::text as "statusChangedAt", i.updated_at::text as "updatedAt"
    from issues i
    join issue_types t on t.id = i.type_id
    join workflow_statuses s on s.id = i.status_id
    left join users a on a.id = i.assignee_id
    left join users r on r.id = i.reporter_id
    left join sprints sp on sp.id = i.sprint_id
    left join issues p on p.id = i.parent_id
    left join versions v on v.id = i.fix_version_id
    left join components c on c.id = i.component_id
    where i.id = ${id} and i.deleted_at is null`;
  return row ?? null;
}

export interface CommentFacts {
  id: string;
  authorId: string | null;
  author: string | null;
  body: string;
  createdAt: string;
}

/** The last `limit` comments, oldest first, and how many there are in all. */
export async function readRecentComments(
  sql: SqlExecutor,
  issueId: string,
  limit: number,
): Promise<{ comments: CommentFacts[]; total: number }> {
  const rows = await sql<(CommentFacts & { total: number })[]>`
    select c.id, c.author_id as "authorId", u.name as author, c.body_text as body,
      c.created_at::text as "createdAt", count(*) over ()::int as total
    from comments c left join users u on u.id = c.author_id
    where c.target_kind = 'issue' and c.target_id = ${issueId} and c.deleted_at is null
    order by c.id desc limit ${limit}`;
  return {
    comments: rows.map(({ total: _total, ...comment }) => comment).reverse(),
    total: rows[0]?.total ?? 0,
  };
}

export interface HistoryFacts {
  id: string;
  field: string;
  from: unknown;
  to: unknown;
  actor: string | null;
  createdAt: string;
}

/** Changes after `since` (the last summary), or the latest few when there is none. */
export async function readHistorySince(
  sql: SqlExecutor,
  issueId: string,
  since: Date | null,
  limit: number,
): Promise<HistoryFacts[]> {
  const rows = since
    ? await sql<HistoryFacts[]>`
        select h.id, h.field, h.from_value as from, h.to_value as to, u.name as actor,
          h.created_at::text as "createdAt"
        from issue_history h left join users u on u.id = h.actor_id
        where h.issue_id = ${issueId} and h.created_at > ${since.toISOString()}::timestamptz
        order by h.id desc limit ${limit}`
    : await sql<HistoryFacts[]>`
        select h.id, h.field, h.from_value as from, h.to_value as to, u.name as actor,
          h.created_at::text as "createdAt"
        from issue_history h left join users u on u.id = h.actor_id
        where h.issue_id = ${issueId}
        order by h.id desc limit ${limit}`;
  return rows.reverse();
}

/** Names for the ids history values hold (statuses, people, sprints, versions, components). */
export async function nameIds(
  sql: SqlExecutor,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await sql<{ id: string; name: string }[]>`
    select id, name from workflow_statuses where id = any(${ids}::uuid[])
    union all select id, name from users where id = any(${ids}::uuid[])
    union all select id, name from sprints where id = any(${ids}::uuid[])
    union all select id, name from versions where id = any(${ids}::uuid[])
    union all select id, name from components where id = any(${ids}::uuid[])
    union all select id, name from labels where id = any(${ids}::uuid[])`;
  return new Map(rows.map((row) => [row.id, row.name]));
}

export interface LinkedIssueFacts {
  id: string;
  key: string;
  title: string;
  status: string;
  statusCategory: string;
  projectId: string;
  /** "blocks" when this issue blocks it, "blocked_by" when it blocks this one. */
  direction: 'blocks' | 'blocked_by';
}

export async function readBlockers(sql: SqlExecutor, issueId: string): Promise<LinkedIssueFacts[]> {
  return sql<LinkedIssueFacts[]>`
    select o.id, o.key, o.title, s.name as status, s.category as "statusCategory",
      o.project_id as "projectId",
      case when l.source_id = ${issueId} then 'blocks' else 'blocked_by' end as direction
    from issue_links l
    join issues o on o.id = case when l.source_id = ${issueId} then l.target_id else l.source_id end
    join workflow_statuses s on s.id = o.status_id
    where l.kind = 'blocks' and (l.source_id = ${issueId} or l.target_id = ${issueId})
      and o.deleted_at is null
    order by direction, o.key
    limit 20`;
}

/** The latest change anything in the issue's context made, for quiet periods. */
export async function issueLastChangedAt(sql: SqlExecutor, issueId: string): Promise<Date | null> {
  const [row] = await sql<{ at: string | null }[]>`
    select greatest(
      (select updated_at from issues where id = ${issueId}),
      (select max(created_at) from comments where target_kind = 'issue' and target_id = ${issueId})
    )::text as at`;
  return row?.at ? new Date(row.at) : null;
}
