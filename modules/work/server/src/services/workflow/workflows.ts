import type { RequestContext, ResourceRef, SqlClient } from '@bemmoly/core';
import { ConflictError, ProviderError } from '@bemmoly/shared';
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
  WORKFLOW_COLUMNS,
  type WorkflowRow,
} from './rows.ts';
import { copyWorkflowToProject } from './project-copy.ts';

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
        select ${sql.unsafe(WORKFLOW_COLUMNS)}
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
     * project's issues and board columns move onto the copy's statuses.
     */
    async create(ctx: RequestContext, body: CreateWorkflowBody): Promise<Workflow> {
      const resource: ResourceRef = body.projectId
        ? { kind: 'project', id: body.projectId, moduleId: 'work' }
        : MODULE;
      await ctx.authz.authorize(ctx.actor, 'work.project.configure', resource);
      const sql = db();
      const created = await sql.begin(async (tx) => {
        if (body.projectId) {
          const [taken] = await tx<{ id: string }[]>`
            select id from workflows where project_id = ${body.projectId} limit 1`;
          if (taken) throw new ConflictError('The project already has its own workflow');
        }
        if (body.projectId) {
          return copyWorkflowToProject(tx, { id: body.projectId, key: '' }, body.name);
        }
        const [row] = await tx<WorkflowRow[]>`
          insert into workflows (project_id, origin_id, name, published_version, draft)
          values (null, null, ${body.name}, 0, null)
          returning ${tx.unsafe(WORKFLOW_COLUMNS)}`;
        if (!row) throw new ProviderError('The workflow was not stored');
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

export type WorkflowReads = ReturnType<typeof createWorkflowReads>;
