import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { PublishWorkflowBody, Workflow, WorkflowDraft } from '../../../../shared/index.ts';
import type { WorkflowServiceDeps } from './deps.ts';
import { countIssuesByStatus, moveIssuesStatus } from './issue-access.ts';
import {
  loadStatuses,
  loadTransitions,
  loadWorkflow,
  toWorkflow,
  WORKFLOW_COLUMNS,
  type StatusRow,
  type WorkflowRow,
} from './rows.ts';
import { validateDraft } from './validate.ts';
import { requireDatabase, resourceOf } from './workflows.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Draft ids are the client's until publish; one that is a real uuid names an existing row. */
const isExisting = (id: string, existing: Map<string, StatusRow>) =>
  UUID.test(id) && existing.has(id.toLowerCase());

/**
 * Publishes under a per-workflow advisory lock so two editors publishing at
 * once get versions 2 and 3, never two version 2s with interleaved rows.
 */
async function lockWorkflow(sql: SqlExecutor, workflowId: string): Promise<void> {
  await sql`select pg_advisory_xact_lock(hashtext('work.workflow.publish'), hashtext(${workflowId}))`;
}

async function upsertStatuses(
  sql: SqlExecutor,
  workflowId: string,
  draft: WorkflowDraft,
  existing: Map<string, StatusRow>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const status of draft.statuses) {
    const color = status.color ?? null;
    const roles = status.allowedRoleIds ?? [];
    const x = status.x ?? null;
    const y = status.y ?? null;
    if (isExisting(status.id, existing)) {
      await sql`
        update workflow_statuses
        set name = ${status.name}, category = ${status.category}, color = ${color},
          position = ${status.position}, allowed_role_ids = ${roles}, x = ${x}, y = ${y},
          updated_at = now()
        where id = ${status.id}`;
      ids.set(status.id, status.id.toLowerCase());
      continue;
    }
    const [row] = await sql<{ id: string }[]>`
      insert into workflow_statuses (workflow_id, name, category, color, position,
        allowed_role_ids, x, y)
      values (${workflowId}, ${status.name}, ${status.category}, ${color}, ${status.position},
        ${roles}, ${x}, ${y})
      returning id`;
    if (row) ids.set(status.id, row.id);
  }
  return ids;
}

/** Issues in a removed status go where the body says; without a mapping the publish is refused. */
async function retireStatuses(
  sql: SqlExecutor,
  removed: StatusRow[],
  mapping: Record<string, string>,
  ids: Map<string, string>,
  actorId: string | null,
): Promise<void> {
  const counts = await countIssuesByStatus(
    sql,
    removed.map((status) => status.id),
  );
  const unmapped = removed.filter((status) => {
    const target = mapping[status.id];
    return (counts.get(status.id) ?? 0) > 0 && (!target || !ids.has(target));
  });
  if (unmapped.length > 0) {
    throw new ValidationError('Say where the issues in removed statuses should go', {
      code: 'validation_failed',
      details: {
        statusMappingRequired: unmapped.map((status) => ({
          statusId: status.id,
          name: status.name,
          issues: counts.get(status.id) ?? 0,
        })),
      },
    });
  }
  for (const status of removed) {
    const target = mapping[status.id];
    if (target) await moveIssuesStatus(sql, status.id, ids.get(target) as string, actorId);
    await sql`delete from workflow_statuses where id = ${status.id}`;
  }
}

async function replaceTransitions(
  sql: SqlExecutor,
  workflowId: string,
  draft: WorkflowDraft,
  ids: Map<string, string>,
): Promise<void> {
  await sql`delete from workflow_transitions where workflow_id = ${workflowId}`;
  for (const transition of draft.transitions) {
    const keepId = UUID.test(transition.id) ? transition.id : null;
    await sql`
      insert into workflow_transitions (id, workflow_id, from_status_id, to_status_id, name,
        rules, position)
      values (coalesce(${keepId}::uuid, uuidv7()), ${workflowId},
        ${transition.fromStatusId ? (ids.get(transition.fromStatusId) ?? null) : null},
        ${ids.get(transition.toStatusId) ?? null}, ${transition.name},
        ${JSON.stringify(transition.rules ?? {})}::jsonb, ${transition.position})`;
  }
}

export function createWorkflowPublisher(deps: WorkflowServiceDeps) {
  return {
    async publish(ctx: RequestContext, id: string, body: PublishWorkflowBody): Promise<Workflow> {
      const sql = requireDatabase(deps);
      const head = await loadWorkflow(sql, id);
      await ctx.authz.authorize(ctx.actor, 'work.project.configure', resourceOf(head));
      const actorId = ctx.actor.kind === 'user' ? ctx.actor.id : (ctx.actor.userId ?? null);
      const published = await sql.begin(async (tx) => {
        await lockWorkflow(tx, id);
        const row = await loadWorkflow(tx, id);
        if (!row.draft) throw new ValidationError('There is no draft to publish');
        const validation = validateDraft(row.draft);
        if (!validation.valid) {
          throw new ValidationError('The draft has problems', {
            details: { problems: validation.problems },
          });
        }
        const existing = new Map((await loadStatuses(tx, id)).map((s) => [s.id, s]));
        const ids = await upsertStatuses(tx, id, row.draft, existing);
        const kept = new Set(ids.values());
        const removed = [...existing.values()].filter((status) => !kept.has(status.id));
        await replaceTransitions(tx, id, row.draft, ids);
        await retireStatuses(tx, removed, body.statusMapping ?? {}, ids, actorId);
        const [next] = await tx<WorkflowRow[]>`
          update workflows
          set published_version = published_version + 1, published_at = now(), draft = null,
            updated_at = now()
          where id = ${id}
          returning ${tx.unsafe(WORKFLOW_COLUMNS)}`;
        return toWorkflow(
          next as WorkflowRow,
          await loadStatuses(tx, id),
          await loadTransitions(tx, id),
        );
      });
      await deps.realtime?.publish({
        kind: 'work.workflow',
        ids: [id],
        ...(head.project_id ? { projectId: head.project_id } : { moduleId: 'work' }),
      });
      return published as Workflow;
    },
  };
}
