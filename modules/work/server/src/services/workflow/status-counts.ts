import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import type { WorkflowStatusCounts } from '../../../../shared/workflow-editor.ts';
import { accessibleProjectIds } from '../issues/deps.ts';
import type { WorkflowRow } from './rows.ts';

/**
 * Issues per status of one workflow, for the "· 42 issues" on each editor
 * node and the cards a Board settings change would hide. Only projects that
 * use the workflow count: its own project for a project copy, every project
 * without a copy for the org default. Only issues the person can open count,
 * and `projectId` narrows to one project. Every status is listed, empty or not.
 */
export async function countStatusIssues(
  sql: SqlExecutor,
  ctx: RequestContext,
  workflow: Pick<WorkflowRow, 'id' | 'project_id'>,
  projectId?: string,
): Promise<WorkflowStatusCounts> {
  const visible = await accessibleProjectIds(ctx, sql);
  const rows = await sql<{ id: string; count: number }[]>`
    select s.id, count(i.id)::int as count
    from workflow_statuses s
    left join issues i on i.status_id = s.id
      and i.deleted_at is null
      and ${
        workflow.project_id
          ? sql`i.project_id = ${workflow.project_id}`
          : sql`not exists (select 1 from workflows own where own.project_id = i.project_id)`
      }
      and (${visible === null} or i.project_id = any(${visible ?? []}::uuid[]))
      and (${projectId ?? null}::uuid is null or i.project_id = ${projectId ?? null}::uuid)
    where s.workflow_id = ${workflow.id}
    group by s.id`;
  return { counts: Object.fromEntries(rows.map((row) => [row.id, row.count])) };
}
