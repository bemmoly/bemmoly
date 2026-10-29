import { NotFoundError } from '@bemmoly/shared';
import {
  workflowSpecSchema,
  type ApprovalRequest,
  type ApprovalStatus,
  type ApprovalTask,
  type ApprovalTaskStatus,
  type WorkflowSpec,
} from '@bemmoly/shared/approvals';
import type { SqlExecutor } from '../../contracts/sql.ts';

export interface RequestRow {
  id: string;
  workflow_version_id: string;
  module_id: string;
  workflow_key: string;
  subject_kind: string;
  subject_id: string;
  title: string;
  url: string | null;
  requester_id: string;
  fields: Record<string, string | number | boolean | null>;
  status: ApprovalStatus;
  current_stage: number | null;
  auto_approved: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  closed_at: Date | string | null;
}

export interface TaskRow {
  id: string;
  request_id: string;
  stage: number;
  approver_id: string;
  on_behalf_of: string | null;
  status: ApprovalTaskStatus;
  escalation: boolean;
  comment: string | null;
  due_at: Date | string | null;
  decided_at: Date | string | null;
}

/** A request with what its version says and its tasks, as the runtime works on it. */
export interface LoadedRequest {
  row: RequestRow;
  version: number;
  spec: WorkflowSpec;
  tasks: TaskRow[];
}

const iso = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null;

export const OPEN: readonly ApprovalStatus[] = ['pending', 'escalated'];

export const isOpen = (status: ApprovalStatus) => OPEN.includes(status);

function toTask(row: TaskRow): ApprovalTask {
  return {
    id: row.id,
    stage: row.stage,
    approverId: row.approver_id,
    onBehalfOf: row.on_behalf_of,
    status: row.status,
    escalation: row.escalation,
    comment: row.comment,
    dueAt: iso(row.due_at),
    decidedAt: iso(row.decided_at),
  };
}

export function toRequest(loaded: LoadedRequest): ApprovalRequest {
  const { row } = loaded;
  return {
    id: row.id,
    moduleId: row.module_id,
    workflowKey: row.workflow_key,
    workflowVersion: loaded.version,
    subject: { kind: row.subject_kind, id: row.subject_id },
    title: row.title,
    url: row.url,
    requesterId: row.requester_id,
    fields: row.fields,
    status: row.status,
    currentStage: row.current_stage,
    autoApproved: row.auto_approved,
    tasks: loaded.tasks.map(toTask),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
    closedAt: iso(row.closed_at),
  };
}

/** Loads many requests with their tasks and versions in three queries, keeping `rows` order. */
export async function hydrate(sql: SqlExecutor, rows: RequestRow[]): Promise<LoadedRequest[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const versionIds = [...new Set(rows.map((row) => row.workflow_version_id))];
  const [tasks, versions] = await Promise.all([
    sql<TaskRow[]>`select * from approval_tasks where request_id = any(${ids}) order by id`,
    sql<{ id: string; version: number; spec: unknown }[]>`
      select id, version, spec from approval_workflow_versions where id = any(${versionIds})`,
  ]);
  const byVersion = new Map(versions.map((version) => [version.id, version]));
  return rows.map((row) => {
    const version = byVersion.get(row.workflow_version_id)!;
    return {
      row,
      version: version.version,
      spec: workflowSpecSchema.parse(version.spec),
      tasks: tasks.filter((task) => task.request_id === row.id),
    };
  });
}

/** One request; `lock` takes a row lock so two decisions on it run one after the other. */
export async function loadRequest(
  sql: SqlExecutor,
  id: string,
  lock = false,
): Promise<LoadedRequest> {
  const rows = lock
    ? await sql<RequestRow[]>`select * from approval_requests where id = ${id} for update`
    : await sql<RequestRow[]>`select * from approval_requests where id = ${id}`;
  if (rows.length === 0) throw new NotFoundError('Approval request not found');
  const [loaded] = await hydrate(sql, rows);
  return loaded!;
}
