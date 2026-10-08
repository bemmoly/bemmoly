import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import type { IssueDetail, IssuesPage, ListIssuesQuery } from '../../../../shared/issues.ts';
import {
  accessibleProjectIds,
  actorUserId,
  MODULE_RESOURCE,
  projectResource,
  requireDatabase,
  type IssueServiceDeps,
} from './deps.ts';
import { ISSUE_COLUMNS, loadIssueByKey, toIssue, type IssueRow } from './rows.ts';

type Related = Omit<IssueDetail, keyof ReturnType<typeof toIssue>>;

/**
 * Everything the Issue page prints beside the row, in one statement: the
 * names behind each id, both sides of every link, subtasks and watchers.
 * Links read from the far side so "blocks" and "blocked by" are one table.
 */
async function loadRelated(sql: SqlExecutor, row: IssueRow, userId: string | null) {
  const [related] = await sql<Related[]>`
    select
      (select jsonb_build_object('id', t.id, 'name', t.name, 'key', t.key, 'level', t.level,
         'icon', t.icon) from issue_types t where t.id = ${row.type_id}) as "type",
      (select jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category,
         'color', s.color) from workflow_statuses s where s.id = ${row.status_id}) as "status",
      (select jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
         from users u where u.id = ${row.assignee_id}) as "assignee",
      (select jsonb_build_object('id', u.id, 'name', u.name, 'email', u.email)
         from users u where u.id = ${row.reporter_id}) as "reporter",
      (select jsonb_build_object('id', p.id, 'key', p.key, 'title', p.title,
         'statusId', p.status_id, 'typeId', p.type_id)
         from issues p where p.id = ${row.parent_id} and p.deleted_at is null) as "parent",
      (select jsonb_build_object('id', sp.id, 'name', sp.name, 'state', sp.state)
         from sprints sp where sp.id = ${row.sprint_id}) as "sprint",
      (select jsonb_build_object('id', v.id, 'name', v.name)
         from versions v where v.id = ${row.fix_version_id}) as "fixVersion",
      coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name, 'color', l.color)
         order by l.name) from issue_labels il join labels l on l.id = il.label_id
         where il.issue_id = ${row.id}), '[]'::jsonb) as "labels",
      coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'kind', k.kind,
         'inverse', k.target_id = ${row.id},
         'issue', jsonb_build_object('id', o.id, 'key', o.key, 'title', o.title,
           'statusId', o.status_id, 'typeId', o.type_id)) order by k.id)
         from issue_links k
         join issues o on o.id = case when k.source_id = ${row.id} then k.target_id
           else k.source_id end
         where (k.source_id = ${row.id} or k.target_id = ${row.id}) and o.deleted_at is null),
         '[]'::jsonb) as "links",
      coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'key', c.key, 'title', c.title,
         'statusId', c.status_id, 'typeId', c.type_id) order by c.rank)
         from issues c where c.parent_id = ${row.id} and c.deleted_at is null),
         '[]'::jsonb) as "subtasks",
      (select count(*)::int from watchers w
         where w.target_kind = 'issue' and w.target_id = ${row.id}) as "watchersCount",
      exists(select 1 from watchers w where w.target_kind = 'issue' and w.target_id = ${row.id}
         and w.user_id = ${userId}) as "watching"`;
  return related;
}

export async function getIssue(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  key: string,
): Promise<IssueDetail> {
  const sql = requireDatabase(deps);
  const row = await loadIssueByKey(sql, key, { includeDeleted: true });
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(row.project_id));
  const related = await loadRelated(sql, row, actorUserId(ctx));
  return { ...toIssue(row), ...(related as Related) };
}

/** Sort columns, each paired with the id so keyset pages never repeat a row. */
const SORTS = {
  created: 'i.id',
  updated: 'i.updated_at',
  priority: `array_position(array['highest','high','medium','low','lowest'], i.priority)`,
  rank: 'i.rank',
  due: 'i.due_at',
} as const;

export async function listIssues(
  deps: IssueServiceDeps,
  ctx: RequestContext,
  query: ListIssuesQuery,
): Promise<IssuesPage> {
  const sql = requireDatabase(deps);
  if (query.projectId) {
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(query.projectId));
  } else {
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
  }
  if (query.deleted) {
    await ctx.authz.authorize(
      ctx.actor,
      'work.issue.delete',
      query.projectId ? projectResource(query.projectId) : MODULE_RESOURCE,
    );
  }
  const projects = query.projectId ? [query.projectId] : await accessibleProjectIds(ctx, sql);
  const cursorId = decodeCursor(query.cursor);
  const direction = query.order === 'desc' ? sql`desc` : sql`asc`;
  const sortExpr = sql.unsafe(SORTS[query.sort]);
  const cmp = query.order === 'desc' ? sql`<` : sql`>`;
  const rows = await sql<IssueRow[]>`
    select ${sql.unsafe(ISSUE_COLUMNS)} from issues i
    where (${query.deleted} and i.deleted_at is not null
        or not ${query.deleted} and i.deleted_at is null)
      and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
      and (${query.sprintId ?? null}::uuid is null or i.sprint_id = ${query.sprintId ?? null})
      and (${query.sprint !== 'none'} or i.sprint_id is null)
      and (${query.statusId ?? null}::uuid is null or i.status_id = ${query.statusId ?? null})
      and (${query.assigneeId ?? null}::uuid is null
        or i.assignee_id = ${query.assigneeId ?? null})
      and (${query.typeId ?? null}::uuid is null or i.type_id = ${query.typeId ?? null})
      and (${query.parentId ?? null}::uuid is null or i.parent_id = ${query.parentId ?? null})
      ${
        cursorId
          ? sql`and (${sortExpr}, i.id) ${cmp}
              ((select ${sortExpr} from issues i where i.id = ${cursorId}), ${cursorId})`
          : sql``
      }
    order by ${sortExpr} ${direction} nulls last, i.id ${direction}
    limit ${query.limit + 1}`;
  const page = toPage(rows, query.limit);
  return { items: page.rows.map(toIssue), nextCursor: page.nextCursor };
}
