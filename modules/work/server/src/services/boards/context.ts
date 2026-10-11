import type { AuditRecorder, RequestContext, SqlExecutor } from '@bemmoly/core';
import { NotFoundError } from '@bemmoly/shared';
import { WORK_REALTIME_KINDS, type WorkMethod } from '../../../../shared/index.ts';
import type { IssueServiceDeps } from '../issues/index.ts';
import type { LqlService } from '../lql/index.ts';

/*
 * What boards, sprints, the backlog, saved filters and metrics share: the
 * issue-side dependencies plus the audit recorder and the LQL compiler, the
 * project a URL names, and the side effects every planning change ends with.
 */

export interface PlanningDeps extends IssueServiceDeps {
  audit?: AuditRecorder;
  lql: LqlService;
}

export interface PlanningProject {
  id: string;
  key: string;
  method: WorkMethod;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The project behind a URL segment, which may be its key ("PLT") or its id:
 * the Board screen holds ids, links and settings hold keys.
 */
export async function resolveProject(sql: SqlExecutor, ref: string): Promise<PlanningProject> {
  const byId = UUID.test(ref);
  const [row] = await sql<PlanningProject[]>`
    select id, key, method from projects
    where ${byId ? sql`id = ${ref}::uuid` : sql`key = ${ref.toUpperCase()}`}`;
  if (!row) throw new NotFoundError(`Project ${ref} was not found`);
  return row;
}

export interface StatusRow {
  id: string;
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  position: number;
}

/**
 * The statuses issues of a project can hold: its own workflow when it has
 * overridden the default, the org default otherwise, as issue create reads it.
 */
export async function projectStatuses(sql: SqlExecutor, projectId: string): Promise<StatusRow[]> {
  return sql<StatusRow[]>`
    select s.id, s.name, s.category, s.position from workflow_statuses s
    where s.workflow_id = (
      select w.id from workflows w where w.project_id = ${projectId} or w.project_id is null
      order by w.project_id nulls last, w.id limit 1)
    order by s.position, s.id`;
}

/** Statuses in the done category of any workflow a project's issues can be in. */
export async function doneStatusIds(sql: SqlExecutor, projectId: string): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select s.id from workflow_statuses s join workflows w on w.id = s.workflow_id
    where (w.project_id = ${projectId} or w.project_id is null) and s.category = 'done'`;
  return rows.map((row) => row.id);
}

export const auditMeta = (ctx: RequestContext) => ({
  ...(ctx.ip ? { ip: ctx.ip } : {}),
  ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
});

export interface AuditChange {
  action: string;
  target: { kind: string; id: string };
  before?: unknown;
  after?: unknown;
}

/** One audit row per planning change, in the change's transaction. */
export async function audit(
  deps: Pick<PlanningDeps, 'audit'>,
  ctx: RequestContext,
  tx: SqlExecutor,
  change: AuditChange,
): Promise<void> {
  await deps.audit?.record({ actor: ctx.actor, ...change, meta: auditMeta(ctx) }, tx);
}

/**
 * Tells the board and backlog sockets of a project to refetch, once the
 * transaction commits; the org default board scheme is scoped to the module.
 */
export async function publishPlanningChange(
  deps: Pick<PlanningDeps, 'realtime'>,
  tx: SqlExecutor,
  projectId: string | null,
  change: { boardIds?: readonly string[]; sprintIds?: readonly string[] },
): Promise<void> {
  const scope = projectId ? { projectId } : { moduleId: 'work' };
  const send = (kind: string, ids: readonly string[]) =>
    ids.length > 0
      ? deps.realtime.publish({ kind, ids: [...new Set(ids)], ...scope }, { transaction: tx })
      : Promise.resolve();
  await send(WORK_REALTIME_KINDS.board, change.boardIds ?? []);
  await send(WORK_REALTIME_KINDS.sprint, change.sprintIds ?? []);
}

export const numberOrNull = (value: string | number | null): number | null =>
  value === null ? null : Number(value);
