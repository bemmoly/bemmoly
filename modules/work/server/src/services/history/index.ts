import { decodeCursor, toPage, type RequestContext, type SqlExecutor } from '@bemmoly/core';
import type {
  IssueHistoryEntry,
  IssueHistoryPage,
  ListIssueHistoryQuery,
} from '../../../../shared/activity.ts';
import { iso, projectResource, requireDatabase, type IssueServiceDeps } from '../issues/deps.ts';
import { loadIssueByKey } from '../issues/rows.ts';

interface HistoryRow {
  id: string;
  issue_id: string;
  actor_id: string | null;
  field: string;
  from_value: unknown;
  to_value: unknown;
  ai_plan_id: string | null;
  created_at: Date | string;
}

export interface HistoryChange {
  field: string;
  from: unknown;
  to: unknown;
}

const toEntry = (row: HistoryRow): IssueHistoryEntry => ({
  id: row.id,
  issueId: row.issue_id,
  actorId: row.actor_id,
  field: row.field,
  from: row.from_value ?? null,
  to: row.to_value ?? null,
  aiPlanId: row.ai_plan_id,
  createdAt: iso(row.created_at),
});

const json = (value: unknown) => (value === undefined ? null : JSON.stringify(value));

/**
 * Writes one row per changed field inside the caller's transaction, so the
 * History tab never shows a change the issue did not keep. Append only.
 */
export async function recordHistory(
  tx: SqlExecutor,
  issueId: string,
  actorId: string | null,
  changes: readonly HistoryChange[],
): Promise<void> {
  for (const change of changes) {
    await tx`
      insert into issue_history (issue_id, actor_id, field, from_value, to_value)
      values (${issueId}, ${actorId}, ${change.field}, ${json(change.from)}::jsonb,
        ${json(change.to)}::jsonb)`;
  }
}

export function createHistoryService(deps: Pick<IssueServiceDeps, 'database'>) {
  return {
    async list(
      ctx: RequestContext,
      key: string,
      query: ListIssueHistoryQuery,
    ): Promise<IssueHistoryPage> {
      const sql = requireDatabase(deps);
      const issue = await loadIssueByKey(sql, key);
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(issue.project_id));
      const cursor = decodeCursor(query.cursor);
      const rows = await sql<HistoryRow[]>`
        select id, issue_id, actor_id, field, from_value, to_value, ai_plan_id, created_at
        from issue_history
        where issue_id = ${issue.id}
          and (${query.field ?? null}::text is null or field = ${query.field ?? null})
          ${cursor ? sql`and id < ${cursor}` : sql``}
        order by id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toEntry), nextCursor: page.nextCursor };
    },
  };
}

export type HistoryService = ReturnType<typeof createHistoryService>;
