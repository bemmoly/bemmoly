import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ForbiddenError } from '@bemmoly/shared';
import type { MyIssue, MyIssueList, MyIssues, MyIssuesQuery } from '../../../../shared/my-work.ts';
import {
  accessibleProjectIds,
  actorUserId,
  iso,
  MODULE_RESOURCE,
  requireDatabase,
  type IssueServiceDeps,
} from '../issues/deps.ts';

type Tab = keyof MyIssues;

interface MyIssueRow {
  id: string;
  key: string;
  title: string;
  priority: MyIssue['priority'];
  due_at: string | null;
  updated_at: Date | string;
  status: MyIssue['status'];
  type: MyIssue['type'];
  total: string | number;
}

/** Which issues each tab holds, for the person `me`. */
function tabFilter(sql: SqlExecutor, tab: Tab, me: string) {
  if (tab === 'assigned') return sql`i.assignee_id = ${me}`;
  if (tab === 'reported') return sql`i.reporter_id = ${me}`;
  return sql`exists (select 1 from watchers w where w.target_kind = 'issue'
      and w.target_id = i.id and w.user_id = ${me})
    and i.reporter_id is distinct from ${me} and i.assignee_id is distinct from ${me}`;
}

async function listTab(
  sql: SqlExecutor,
  tab: Tab,
  me: string,
  projects: string[] | null,
  limit: number,
): Promise<MyIssueList> {
  // Open work first, then what changed last; the window count is the tab's total.
  const rows = await sql<MyIssueRow[]>`
    select i.id, i.key, i.title, i.priority, i.due_at::text as due_at, i.updated_at,
      jsonb_build_object('id', s.id, 'name', s.name, 'category', s.category,
        'color', s.color) as status,
      jsonb_build_object('id', t.id, 'key', t.key, 'name', t.name, 'icon', t.icon,
        'color', t.color) as type,
      count(*) over () as total
    from issues i
    join workflow_statuses s on s.id = i.status_id
    join issue_types t on t.id = i.type_id
    where i.deleted_at is null
      and ${tabFilter(sql, tab, me)}
      and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
    order by (s.category = 'done'), i.updated_at desc, i.id desc
    limit ${limit}`;
  return {
    items: rows.map((row) => ({
      id: row.id,
      key: row.key,
      title: row.title,
      priority: row.priority,
      dueAt: row.due_at,
      updatedAt: iso(row.updated_at),
      status: row.status,
      type: row.type,
    })),
    total: Number(rows[0]?.total ?? 0),
  };
}

/**
 * The person's own issues for Home, within the projects they can open: a
 * project they have left drops out of their lists even if an issue there
 * still names them.
 */
export function createMyWorkService(deps: Pick<IssueServiceDeps, 'database'>) {
  return {
    async list(ctx: RequestContext, query: MyIssuesQuery): Promise<MyIssues> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const me = actorUserId(ctx);
      if (!me) throw new ForbiddenError('Only a person has their own work');
      const sql = requireDatabase(deps);
      const projects = await accessibleProjectIds(ctx, sql);
      const [assigned, reported, watching] = await Promise.all(
        (['assigned', 'reported', 'watching'] as const).map((tab) =>
          listTab(sql, tab, me, projects, query.limit),
        ),
      );
      return {
        assigned: assigned as MyIssueList,
        reported: reported as MyIssueList,
        watching: watching as MyIssueList,
      };
    },
  };
}

export type MyWorkService = ReturnType<typeof createMyWorkService>;
