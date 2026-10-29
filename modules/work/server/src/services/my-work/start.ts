import type { RequestContext, StartSourceDefinition } from '@bemmoly/core';
import type { ModuleStartSummaryInput } from '@bemmoly/shared';
import { issuePath } from '../issues/notify.ts';
import {
  accessibleProjectIds,
  actorUserId,
  iso,
  MODULE_RESOURCE,
  requireDatabase,
  type IssueServiceDeps,
} from '../issues/deps.ts';

/** How far ahead a due date counts as needing the person now. */
const DUE_WITHIN_DAYS = 7;
const LIMIT = 5;

interface StartRow {
  key: string;
  title: string;
  project: string;
  status: string;
  due_at: string | null;
  updated_at: Date | string;
  due_soon: boolean;
  total: string | number;
}

/**
 * Work's part of the start page: open issues assigned to the person. "Needs you" is the ones
 * overdue or due within a week, soonest first; recent is the ones that changed last.
 */
export function createWorkStartSource(deps: Pick<IssueServiceDeps, 'database'>) {
  return {
    async summaryForUser(ctx: RequestContext): Promise<ModuleStartSummaryInput> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE_RESOURCE);
      const me = actorUserId(ctx);
      if (!me) return { waiting: null, needsYou: [], recent: [] };
      const sql = requireDatabase(deps);
      const projects = await accessibleProjectIds(ctx, sql);
      const rows = await sql<StartRow[]>`
        select i.key, i.title, p.name as project, s.name as status,
          i.due_at::text as due_at, i.updated_at,
          (i.due_at is not null
            and i.due_at <= current_date + ${DUE_WITHIN_DAYS}::int) as due_soon,
          count(*) over () as total
        from issues i
        join projects p on p.id = i.project_id
        join workflow_statuses s on s.id = i.status_id
        where i.deleted_at is null and i.archived_at is null and s.category <> 'done'
          and i.assignee_id = ${me}
          and (${projects === null} or i.project_id = any(${projects ?? []}::uuid[]))
        order by i.updated_at desc, i.id desc
        limit 50`;
      const entry = (row: StartRow, context: string, at: string | null) => ({
        id: `issue:${row.key}`,
        title: row.title,
        handle: row.key,
        context,
        path: issuePath(row.key),
        at,
      });
      const count = Number(rows[0]?.total ?? 0);
      return {
        waiting: {
          count,
          label: count === 1 ? 'issue assigned to you' : 'issues assigned to you',
        },
        needsYou: rows
          .filter((row) => row.due_soon && row.due_at)
          .sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
          .slice(0, LIMIT)
          .map((row) => entry(row, `Due · ${row.project}`, iso(`${row.due_at}T00:00:00Z`))),
        recent: rows
          .slice(0, LIMIT)
          .map((row) => entry(row, `${row.status} · ${row.project}`, iso(row.updated_at))),
      };
    },
  } satisfies StartSourceDefinition;
}
