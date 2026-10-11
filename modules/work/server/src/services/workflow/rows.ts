import type { SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import type {
  StatusCategory,
  TransitionRules,
  Workflow,
  WorkflowDraft,
  WorkflowStatus,
  WorkflowTransition,
} from '../../../../shared/index.ts';

export interface WorkflowRow {
  id: string;
  project_id: string | null;
  origin_id: string | null;
  name: string;
  published_version: number;
  published_at: Date | string | null;
  draft: WorkflowDraft | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface StatusRow {
  id: string;
  workflow_id: string;
  name: string;
  category: StatusCategory;
  color: string | null;
  position: number;
  allowed_role_ids: string[];
  x: number | null;
  y: number | null;
}

export interface TransitionRow {
  id: string;
  workflow_id: string;
  from_status_id: string | null;
  to_status_id: string;
  name: string;
  rules: TransitionRules;
  position: number;
}

const iso = (value: Date | string) => new Date(value).toISOString();

export const WORKFLOW_COLUMNS = `id, project_id, origin_id, name, published_version, published_at,
  draft, created_at, updated_at`;

export const STATUS_COLUMNS =
  'id, workflow_id, name, category, color, position, allowed_role_ids, x, y';

export const toStatus = (row: StatusRow): WorkflowStatus => ({
  id: row.id,
  workflowId: row.workflow_id,
  name: row.name,
  category: row.category,
  color: row.color,
  position: row.position,
  allowedRoleIds: row.allowed_role_ids,
  x: row.x,
  y: row.y,
});

export const toTransition = (row: TransitionRow): WorkflowTransition => ({
  id: row.id,
  workflowId: row.workflow_id,
  fromStatusId: row.from_status_id,
  toStatusId: row.to_status_id,
  name: row.name,
  rules: row.rules,
  position: row.position,
});

export const toWorkflow = (
  row: WorkflowRow,
  statuses: StatusRow[],
  transitions: TransitionRow[],
): Workflow => ({
  id: row.id,
  projectId: row.project_id,
  originId: row.origin_id,
  name: row.name,
  publishedVersion: row.published_version,
  publishedAt: row.published_at ? iso(row.published_at) : null,
  hasDraft: row.draft !== null,
  statuses: statuses.map(toStatus),
  transitions: transitions.map(toTransition),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
});

export async function loadWorkflow(sql: SqlExecutor, id: string): Promise<WorkflowRow> {
  const [row] = await sql<WorkflowRow[]>`
    select ${sql.unsafe(WORKFLOW_COLUMNS)}
    from workflows where id = ${id}`;
  if (!row) throw new NotFoundError('The workflow was not found');
  return row;
}

/** A project's own workflow when it has one, else the org default; null only before the seed ran. */
export async function loadWorkflowForProject(
  sql: SqlExecutor,
  projectId: string,
): Promise<WorkflowRow | null> {
  const rows = await sql<WorkflowRow[]>`
    select ${sql.unsafe(WORKFLOW_COLUMNS)}
    from workflows
    where project_id = ${projectId} or project_id is null
    order by project_id nulls last, id
    limit 1`;
  return rows[0] ?? null;
}

export async function loadStatuses(sql: SqlExecutor, workflowId: string): Promise<StatusRow[]> {
  return sql<StatusRow[]>`
    select ${sql.unsafe(STATUS_COLUMNS)}
    from workflow_statuses where workflow_id = ${workflowId}
    order by position, id`;
}

export async function loadTransitions(
  sql: SqlExecutor,
  workflowId: string,
): Promise<TransitionRow[]> {
  return sql<TransitionRow[]>`
    select id, workflow_id, from_status_id, to_status_id, name, rules, position
    from workflow_transitions where workflow_id = ${workflowId}
    order by position, id`;
}

/** The draft the editor sees when none is saved: the published statuses and transitions. */
export function draftOf(
  row: WorkflowRow,
  statuses: StatusRow[],
  transitions: TransitionRow[],
): WorkflowDraft {
  if (row.draft) return row.draft;
  return {
    statuses: statuses.map((status) => ({
      id: status.id,
      name: status.name,
      category: status.category,
      ...(status.color ? { color: status.color } : {}),
      position: status.position,
      allowedRoleIds: status.allowed_role_ids,
      ...(status.x !== null ? { x: status.x } : {}),
      ...(status.y !== null ? { y: status.y } : {}),
    })),
    transitions: transitions.map((transition) => ({
      id: transition.id,
      fromStatusId: transition.from_status_id,
      toStatusId: transition.to_status_id,
      name: transition.name,
      rules: transition.rules,
      position: transition.position,
    })),
  };
}
