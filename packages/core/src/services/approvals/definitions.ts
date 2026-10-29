import { NotFoundError } from '@bemmoly/shared';
import {
  saveWorkflowBodySchema,
  workflowSpecSchema,
  type ApprovalWorkflow,
  type SaveWorkflowBody,
  type WorkflowSpec,
} from '@bemmoly/shared/approvals';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { APPROVALS_ADMIN_CAPABILITY, userIdOf, WORKSPACE, type ApprovalDeps } from './context.ts';

interface WorkflowRow {
  id: string;
  module_id: string;
  key: string;
  name: string;
  version: number;
  version_id: string;
  spec: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

function toWorkflow(row: WorkflowRow): ApprovalWorkflow {
  return {
    id: row.id,
    moduleId: row.module_id,
    key: row.key,
    name: row.name,
    version: row.version,
    versionId: row.version_id,
    spec: workflowSpecSchema.parse(row.spec),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

const latest = (sql: SqlExecutor) => sql`
  select w.id, w.module_id, w.key, w.name, v.version, v.id as version_id, v.spec,
    w.created_at, w.updated_at
  from approval_workflows w
  join approval_workflow_versions v on v.workflow_id = w.id and v.version = w.latest_version`;

/** The version a new request runs on: the latest one saved. */
export async function currentVersion(
  sql: SqlExecutor,
  moduleId: string,
  key: string,
): Promise<{ versionId: string; version: number; spec: WorkflowSpec }> {
  const [row] = await sql<WorkflowRow[]>`
    ${latest(sql)} where w.module_id = ${moduleId} and w.key = ${key}`;
  if (!row) throw new NotFoundError(`No approval workflow ${key} in ${moduleId}`);
  return {
    versionId: row.version_id,
    version: row.version,
    spec: workflowSpecSchema.parse(row.spec),
  };
}

/** Settings' view of definitions: admins read them and save new versions. */
export function createDefinitions(deps: ApprovalDeps) {
  const { sql } = deps;
  const admin = (actor: Actor) => deps.authorize(actor, APPROVALS_ADMIN_CAPABILITY, WORKSPACE);

  return {
    async list(actor: Actor, moduleId?: string): Promise<ApprovalWorkflow[]> {
      await admin(actor);
      const rows = moduleId
        ? await sql<WorkflowRow[]>`${latest(sql)} where w.module_id = ${moduleId} order by w.key`
        : await sql<WorkflowRow[]>`${latest(sql)} order by w.module_id, w.key`;
      return rows.map(toWorkflow);
    },

    async get(actor: Actor, id: string): Promise<ApprovalWorkflow> {
      await admin(actor);
      const [row] = await sql<WorkflowRow[]>`${latest(sql)} where w.id = ${id}`;
      if (!row) throw new NotFoundError('Approval workflow not found');
      return toWorkflow(row);
    },

    /** Never edits a version in place: running requests keep the rules they started under. */
    async save(actor: Actor, input: SaveWorkflowBody): Promise<ApprovalWorkflow> {
      await admin(actor);
      const body = saveWorkflowBodySchema.parse(input);
      const id = await sql.begin(async (tx) => {
        const [workflow] = await tx<{ id: string; latest_version: number }[]>`
          insert into approval_workflows (module_id, key, name, latest_version)
          values (${body.moduleId}, ${body.key}, ${body.name}, 1)
          on conflict (module_id, key) do update
            set name = excluded.name, latest_version = approval_workflows.latest_version + 1,
              updated_at = now()
          returning id, latest_version`;
        await tx`
          insert into approval_workflow_versions (workflow_id, version, spec, created_by)
          values (${workflow!.id}, ${workflow!.latest_version}, ${JSON.stringify(body.spec)}::jsonb,
            ${userIdOf(actor)})`;
        await deps.audit.record(
          {
            actor,
            action: 'approval_workflow.saved',
            target: { kind: 'approval_workflow', id: workflow!.id },
            after: { key: body.key, version: workflow!.latest_version, spec: body.spec },
          },
          tx,
        );
        return workflow!.id;
      });
      const [row] = await sql<WorkflowRow[]>`${latest(sql)} where w.id = ${id as string}`;
      return toWorkflow(row!);
    },
  };
}

export type Definitions = ReturnType<typeof createDefinitions>;
