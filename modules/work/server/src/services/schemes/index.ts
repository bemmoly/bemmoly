import type {
  AuditRecorder,
  RealtimePublisher,
  RequestContext,
  SqlClient,
  SqlExecutor,
} from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import { WORK_REALTIME_KINDS } from '../../../../shared/realtime.ts';
import {
  SCHEME_KINDS,
  type SchemeDiff,
  type SchemeKind,
  type SchemesResponse,
} from '../../../../shared/schemes.ts';
import { ensureProjectBoards } from '../boards/defaults.ts';
import { PROJECT_CHANGED } from '../projects/index.ts';
import { userIdOf } from '../lql/access.ts';
import {
  auditMeta,
  PROJECT_COLUMNS,
  projectByKey,
  projectResource,
  toProject,
  type ProjectRow,
} from '../projects/rows.ts';
import {
  copyWorkflowToProject,
  dropProjectWorkflow,
  ownWorkflow,
} from '../workflow/project-copy.ts';
import { inheritedBoardConfig, schemeState } from './compare.ts';
import { overrideFields, overrideTypes, resetFields, resetTypes } from './copy-types.ts';

export interface SchemesServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
}

/** The project's boards take the configuration they would have inherited. */
async function resetBoards(tx: SqlExecutor, project: ProjectRow): Promise<void> {
  const { config } = await inheritedBoardConfig(tx, project.id);
  await tx`
    update boards set config = ${JSON.stringify(config)}::jsonb, updated_at = now()
    where project_id = ${project.id}`;
}

const COPY: Record<SchemeKind, (tx: SqlExecutor, project: ProjectRow) => Promise<void>> = {
  issue_types: (tx, project) => overrideTypes(tx, project.id),
  fields: (tx, project) => overrideFields(tx, project.id),
  workflow: async (tx, project) => {
    if (!(await ownWorkflow(tx, project.id))) await copyWorkflowToProject(tx, project);
  },
  board: async (tx, project) => {
    await ensureProjectBoards(tx, project);
  },
};

const DROP: Record<SchemeKind, (tx: SqlExecutor, project: ProjectRow) => Promise<void>> = {
  issue_types: (tx, project) => resetTypes(tx, project.id),
  fields: (tx, project) => resetFields(tx, project.id),
  workflow: (tx, project) => dropProjectWorkflow(tx, project.id),
  board: resetBoards,
};

/**
 * A project's schemes against the org defaults (tech design §14): which it
 * inherits, what its copies change, and override and reset. Reading needs
 * issue view in the project; override and reset need "Configure project",
 * run under a lock on the project row, are audited and tell the project's
 * screens to refetch.
 */
export function createSchemesService(deps: SchemesServiceDeps) {
  const db = (): SqlClient => {
    if (!deps.database) throw new ProviderError('The work module needs the database');
    return deps.database;
  };

  async function readable(ctx: RequestContext, ref: string) {
    const project = await projectByKey(db(), ref);
    await ctx.authz.authorize(ctx.actor, 'work.issue.view', projectResource(project.id));
    return project;
  }

  async function change(ctx: RequestContext, ref: string, kind: SchemeKind, override: boolean) {
    const sql = db();
    const project = await projectByKey(sql, ref);
    await ctx.authz.authorize(ctx.actor, 'work.project.configure', projectResource(project.id));
    await sql.begin(async (tx) => {
      const [locked] = await tx<ProjectRow[]>`
        select ${tx.unsafe(PROJECT_COLUMNS)} from projects where id = ${project.id} for update`;
      const current = locked ?? project;
      const state = await schemeState(tx, current, kind);
      if (state.overridden === override && Boolean(current.scheme_overrides[kind]) === override) {
        return;
      }
      if (override && !state.overridden) await COPY[kind](tx, current);
      if (!override && state.overridden) await DROP[kind](tx, current);
      const mark = JSON.stringify({
        overriddenAt: new Date().toISOString(),
        overriddenBy: userIdOf(ctx),
      });
      const [after] = await tx<ProjectRow[]>`
        update projects set
          scheme_overrides = ${
            override
              ? tx`scheme_overrides || jsonb_build_object(${kind}::text, ${mark}::jsonb)`
              : tx`scheme_overrides - ${kind}::text`
          },
          updated_at = now()
        where id = ${project.id}
        returning ${tx.unsafe(PROJECT_COLUMNS)}`;
      await deps.audit?.record(
        {
          actor: ctx.actor,
          action: override ? 'project.scheme.overridden' : 'project.scheme.reset',
          target: { kind: 'project', id: project.id },
          before: toProject(current),
          ...(after ? { after: toProject(after) } : {}),
          meta: auditMeta(ctx),
        },
        tx,
      );
      const publish = (messageKind: string) =>
        deps.realtime?.publish(
          { kind: messageKind, ids: [project.id], projectId: project.id },
          { transaction: tx },
        );
      await publish(PROJECT_CHANGED);
      await publish(WORK_REALTIME_KINDS.board);
    });
  }

  return {
    async list(ctx: RequestContext, ref: string): Promise<SchemesResponse> {
      const project = await readable(ctx, ref);
      const items = [];
      for (const kind of SCHEME_KINDS) {
        const state = await schemeState(db(), project, kind);
        items.push({
          kind,
          originName: state.originName,
          overridden: state.overridden,
          overrideCount: state.entries.length,
        });
      }
      return { items };
    },

    async diff(ctx: RequestContext, ref: string, kind: SchemeKind): Promise<SchemeDiff> {
      const project = await readable(ctx, ref);
      const state = await schemeState(db(), project, kind);
      return {
        kind,
        overridden: state.overridden,
        mark: project.scheme_overrides[kind] ?? null,
        entries: state.entries,
      };
    },

    /** Copies the org default into the project; a scheme already overridden stays as it is. */
    override: (ctx: RequestContext, ref: string, kind: SchemeKind) => change(ctx, ref, kind, true),

    /** Drops the project's copy and inherits the org default again. */
    reset: (ctx: RequestContext, ref: string, kind: SchemeKind) => change(ctx, ref, kind, false),
  };
}

export type SchemesService = ReturnType<typeof createSchemesService>;
