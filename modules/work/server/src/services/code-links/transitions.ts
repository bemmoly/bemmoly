import type { AuditRecorder, RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ValidationError, type CodeLinkState } from '@bemmoly/shared';
import type { CodeTransitions, UpdateCodeTransitionsBody } from '../../../../shared/code-links.ts';
import { projectByKey, projectResource } from '../projects/rows.ts';
import { loadWorkflowForProject } from '../workflow/rows.ts';

export type CodeTrigger = 'pull_request_opened' | 'pull_request_merged';

const FIELDS: Record<CodeTrigger, keyof CodeTransitions> = {
  pull_request_opened: 'pullRequestOpened',
  pull_request_merged: 'pullRequestMerged',
};

/**
 * Which project setting a pull request's change of state answers to: it opened (created,
 * reopened, or marked ready from a draft) or it merged. Closing and drafting move nothing.
 */
export function triggerOf(
  from: CodeLinkState | null,
  to: CodeLinkState | null,
): CodeTrigger | null {
  if (to === 'merged' && from !== 'merged') return 'pull_request_merged';
  if (to === 'open' && from !== 'open') return 'pull_request_opened';
  return null;
}

async function readTransitions(sql: SqlExecutor, projectId: string): Promise<CodeTransitions> {
  const rows = await sql<{ trigger: CodeTrigger; status_id: string }[]>`
    select trigger, status_id from code_transitions where project_id = ${projectId}`;
  const result: CodeTransitions = { pullRequestOpened: null, pullRequestMerged: null };
  for (const row of rows) result[FIELDS[row.trigger]] = row.status_id;
  return result;
}

/** The status a project moves an issue to on this trigger, or null to leave it. */
export async function transitionTarget(
  sql: SqlExecutor,
  projectId: string,
  trigger: CodeTrigger,
): Promise<string | null> {
  const [row] = await sql<{ status_id: string }[]>`
    select status_id from code_transitions
    where project_id = ${projectId} and trigger = ${trigger}`;
  return row?.status_id ?? null;
}

export async function getCodeTransitions(
  sql: SqlExecutor,
  ctx: RequestContext,
  projectKey: string,
): Promise<CodeTransitions> {
  const project = await projectByKey(sql, projectKey);
  await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
  return readTransitions(sql, project.id);
}

/** Saves the project's moves; each status must be one of the project's workflow's statuses. */
export async function updateCodeTransitions(
  sql: SqlClient,
  audit: AuditRecorder | undefined,
  ctx: RequestContext,
  projectKey: string,
  body: UpdateCodeTransitionsBody,
): Promise<CodeTransitions> {
  const project = await projectByKey(sql, projectKey);
  await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
  return sql.begin(async (tx) => {
    const before = await readTransitions(tx, project.id);
    const workflow = await loadWorkflowForProject(tx, project.id);
    for (const trigger of Object.keys(FIELDS) as CodeTrigger[]) {
      const statusId = body[FIELDS[trigger]];
      if (statusId === undefined) continue;
      if (statusId === null) {
        await tx`delete from code_transitions
          where project_id = ${project.id} and trigger = ${trigger}`;
        continue;
      }
      const [status] = await tx<{ id: string }[]>`
        select id from workflow_statuses
        where id = ${statusId} and workflow_id = ${workflow?.id ?? null}`;
      if (!status) throw new ValidationError("The status is not in this project's workflow");
      await tx`
        insert into code_transitions (project_id, trigger, status_id)
        values (${project.id}, ${trigger}, ${statusId})
        on conflict (project_id, trigger) do update set status_id = excluded.status_id,
          updated_at = now()`;
    }
    const after = await readTransitions(tx, project.id);
    await audit?.record(
      {
        actor: ctx.actor,
        action: 'project.code_transitions_updated',
        target: { kind: 'project', id: project.id },
        before,
        after,
        meta: {
          ...(ctx.ip ? { ip: ctx.ip } : {}),
          ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
        },
      },
      tx,
    );
    return after;
  });
}
