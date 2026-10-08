import type { RequestContext, ResourceRef, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, NotFoundError, ProviderError } from '@bemmoly/shared';
import type {
  CreateWorkflowBody,
  UpdateWorkflowBody,
  Workflow,
  WorkflowDraft,
  WorkflowStatus,
  WorkflowTransition,
} from '../../../../shared/index.ts';
import type { WorkflowServiceDeps } from './deps.ts';
import {
  draftOf,
  loadStatuses,
  loadTransitions,
  loadWorkflow,
  toStatus,
  toTransition,
  toWorkflow,
  type WorkflowRow,
} from './rows.ts';

const MODULE: ResourceRef = { kind: 'module', moduleId: 'work' };

/** Org defaults are workspace-wide; a project's own workflow is that project's resource. */
export const resourceOf = (row: Pick<WorkflowRow, 'project_id'>): ResourceRef =>
  row.project_id ? { kind: 'project', id: row.project_id, moduleId: 'work' } : MODULE;

export function requireDatabase(deps: WorkflowServiceDeps): SqlClient {
  if (!deps.database) throw new ProviderError('The work module needs the database');
  return deps.database;
}

/** Reading, naming and drafting workflows; publishing and moving issues live beside this. */
export function createWorkflowReads(deps: WorkflowServiceDeps) {
  const db = () => requireDatabase(deps);

  async function present(sql: SqlClient, row: WorkflowRow): Promise<Workflow> {
    const [statuses, transitions] = await Promise.all([
      loadStatuses(sql, row.id),
      loadTransitions(sql, row.id),
    ]);
    return toWorkflow(row, statuses, transitions);
  }

  async function getRow(ctx: RequestContext, id: string, capability: 'view' | 'configure') {
    const row = await loadWorkflow(db(), id);
    const name = capability === 'view' ? 'work.issue.view' : 'work.project.configure';
    await ctx.authz.authorize(ctx.actor, name, resourceOf(row));
    return row;
  }

  return {
    async list(ctx: RequestContext, projectId?: string): Promise<Workflow[]> {
      await ctx.authz.authorize(ctx.actor, 'work.issue.view', MODULE);
      const sql = db();
      const rows = await sql<WorkflowRow[]>`
        select id, project_id, origin_id, name, published_version, draft, created_at, updated_at
        from workflows
        where ${projectId ?? null}::uuid is null or project_id is null or project_id = ${projectId ?? null}
        order by project_id nulls first, id`;
      return Promise.all(rows.map((row) => present(sql, row)));
    },

    async get(ctx: RequestContext, id: string): Promise<Workflow> {
      return present(db(), await getRow(ctx, id, 'view'));
    },

    async statuses(ctx: RequestContext, id: string): Promise<WorkflowStatus[]> {
      const row = await getRow(ctx, id, 'view');
      return (await loadStatuses(db(), row.id)).map(toStatus);
    },

    async transitions(ctx: RequestContext, id: string): Promise<WorkflowTransition[]> {
      const row = await getRow(ctx, id, 'view');
      return (await loadTransitions(db(), row.id)).map(toTransition);
    },

    /**
     * A project override is a full copy of the org default, pointed at it by
     * origin_id, which "Reset to org default" and "View diff" act on. The
     * project's scheme pointer is the projects stream's to flip.
     */
    async create(ctx: RequestContext, body: CreateWorkflowBody): Promise<Workflow> {
      const resource: ResourceRef = body.projectId
        ? { kind: 'project', id: body.projectId, moduleId: 'work' }
        : MODULE;
      await ctx.authz.authorize(ctx.actor, 'work.project.configure', resource);
      const sql = db();
      const [origin] = await sql<WorkflowRow[]>`
        select id, project_id, origin_id, name, published_version, draft, created_at, updated_at
        from workflows where project_id is null order by id limit 1`;
      if (body.projectId && !origin) throw new NotFoundError('There is no org default workflow');
      const created = await sql.begin(async (tx) => {
        if (body.projectId) {
          const [taken] = await tx<{ id: string }[]>`
            select id from workflows where project_id = ${body.projectId} limit 1`;
          if (taken) throw new ConflictError('The project already has its own workflow');
        }
        const [row] = await tx<WorkflowRow[]>`
          insert into workflows (project_id, origin_id, name, published_version, draft)
          values (${body.projectId ?? null}, ${body.projectId ? (origin?.id ?? null) : null},
            ${body.name}, ${body.projectId && origin ? 1 : 0}, null)
          returning id, project_id, origin_id, name, published_version, draft, created_at,
            updated_at`;
        if (!row) throw new ProviderError('The workflow was not stored');
        if (body.projectId && origin) await copyContent(tx, origin.id, row.id);
        return row;
      });
      return present(sql, created as WorkflowRow);
    },

    async update(ctx: RequestContext, id: string, body: UpdateWorkflowBody): Promise<Workflow> {
      const row = await getRow(ctx, id, 'configure');
      const sql = db();
      if (body.name !== undefined) {
        await sql`update workflows set name = ${body.name}, updated_at = now() where id = ${id}`;
      }
      return present(sql, { ...row, name: body.name ?? row.name });
    },

    async getDraft(ctx: RequestContext, id: string): Promise<WorkflowDraft> {
      const row = await getRow(ctx, id, 'configure');
      const sql = db();
      return draftOf(row, await loadStatuses(sql, id), await loadTransitions(sql, id));
    },

    async putDraft(ctx: RequestContext, id: string, draft: WorkflowDraft): Promise<WorkflowDraft> {
      await getRow(ctx, id, 'configure');
      await db()`
        update workflows set draft = ${JSON.stringify(draft)}::jsonb, updated_at = now()
        where id = ${id}`;
      return draft;
    },
  };
}

/** Copies statuses with fresh ids, then transitions remapped onto them. */
async function copyContent(tx: SqlExecutor, fromId: string, toId: string): Promise<void> {
  const statuses = await loadStatuses(tx, fromId);
  const ids = new Map<string, string>();
  for (const status of statuses) {
    const [row] = await tx<{ id: string }[]>`
      insert into workflow_statuses (workflow_id, name, category, color, position, allowed_role_ids)
      values (${toId}, ${status.name}, ${status.category}, ${status.color}, ${status.position},
        ${status.allowed_role_ids})
      returning id`;
    if (row) ids.set(status.id, row.id);
  }
  for (const transition of await loadTransitions(tx, fromId)) {
    await tx`
      insert into workflow_transitions (workflow_id, from_status_id, to_status_id, name, rules,
        position)
      values (${toId},
        ${transition.from_status_id ? (ids.get(transition.from_status_id) ?? null) : null},
        ${ids.get(transition.to_status_id) ?? null}, ${transition.name},
        ${JSON.stringify(transition.rules)}::jsonb, ${transition.position})`;
  }
}

export type WorkflowReads = ReturnType<typeof createWorkflowReads>;
