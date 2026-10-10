import {
  NotFoundError,
  type AiPlan,
  type AiPlanContext,
  type AiPlanPermission,
  type AiPlanStatus,
  type AiPlanStepPreview,
  type AiPlanStepStatus,
} from '@bemmoly/shared';
import type { SqlClient } from '../../../clients/postgres.ts';
import type { SqlExecutor } from '../../../contracts/sql.ts';

/*
 * The ai_plans and ai_plan_steps rows. Plans are read only by their owner, so every read
 * takes the user id; the run job reads by id alone.
 */

export interface NewPlanStep {
  tool: string;
  args: Record<string, unknown>;
  preview: AiPlanStepPreview;
  permission: AiPlanPermission;
  reason: string | null;
}

export interface NewPlan {
  userId: string;
  request: string;
  summary: string | null;
  runnable: boolean;
  context: AiPlanContext;
  runId: string | null;
  steps: readonly NewPlanStep[];
}

interface PlanRow {
  id: string;
  user_id: string;
  request_text: string;
  summary: string | null;
  status: AiPlanStatus;
  runnable: boolean;
  run_id: string | null;
  approved_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StepRow {
  plan_id: string;
  step_index: number;
  tool: string;
  args: Record<string, unknown>;
  preview: AiPlanStepPreview;
  permission: AiPlanPermission;
  reason: string | null;
  status: AiPlanStepStatus;
  undo: unknown;
  error: string | null;
}

export interface StoredPlan {
  plan: AiPlan;
  userId: string;
  steps: StepRow[];
}

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

function toPlan(row: PlanRow, steps: StepRow[]): AiPlan {
  return {
    id: row.id,
    request: row.request_text,
    summary: row.summary,
    status: row.status,
    runnable: row.runnable,
    runId: row.run_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    approvedAt: iso(row.approved_at),
    finishedAt: iso(row.finished_at),
    steps: steps.map((step) => ({
      index: step.step_index,
      tool: step.tool,
      args: step.args,
      preview: step.preview,
      permission: step.permission,
      reason: step.reason,
      status: step.status,
      error: step.error,
      undoable: step.status === 'done' && step.undo !== null && step.undo !== undefined,
    })),
  };
}

export async function insertPlan(sql: SqlClient, input: NewPlan): Promise<string> {
  return (await sql.begin(async (tx) => {
    // The run row is linked only when the database has it (the test fake keeps runs in memory).
    const [row] = await tx<{ id: string }[]>`
      insert into ai_plans (user_id, request_text, summary, runnable, context, run_id)
      values (${input.userId}, ${input.request}, ${input.summary}, ${input.runnable},
        ${JSON.stringify(input.context)}::jsonb,
        (select id from ai_runs where id = ${input.runId}::uuid))
      returning id`;
    if (!row) throw new Error('ai_plans insert returned no row');
    for (const [index, step] of input.steps.entries()) {
      await tx`
        insert into ai_plan_steps (plan_id, step_index, tool, args, preview, permission, reason)
        values (${row.id}, ${index}, ${step.tool}, ${JSON.stringify(step.args)}::jsonb,
          ${JSON.stringify(step.preview)}::jsonb, ${step.permission}, ${step.reason})`;
    }
    return row.id;
  })) as string;
}

/** The plan with its steps; NotFound for anyone but its owner (when an owner is given). */
export async function loadPlan(
  sql: SqlExecutor,
  id: string,
  ownerId?: string,
): Promise<StoredPlan> {
  const [row] = await sql<PlanRow[]>`
    select id, user_id, request_text, summary, status, runnable, run_id, approved_at,
      finished_at, created_at, updated_at
    from ai_plans where id = ${id}`;
  if (!row || (ownerId !== undefined && row.user_id !== ownerId)) {
    throw new NotFoundError('The plan was not found');
  }
  const steps = await sql<StepRow[]>`
    select plan_id, step_index, tool, args, preview, permission, reason, status, undo, error
    from ai_plan_steps where plan_id = ${id} order by step_index`;
  return { plan: toPlan(row, steps), userId: row.user_id, steps };
}

export async function setPlanStatus(
  sql: SqlExecutor,
  id: string,
  status: AiPlanStatus,
  from: readonly AiPlanStatus[],
): Promise<boolean> {
  const finished = ['done', 'failed', 'cancelled'].includes(status);
  const rows = await sql`
    update ai_plans set status = ${status}, updated_at = now(),
      finished_at = ${finished ? sql`now()` : sql`finished_at`}
    where id = ${id} and status in ${sql(from)}
    returning id`;
  return rows.length > 0;
}

/** Marks the plan approved and the chosen steps pending, the rest skipped. */
export async function approvePlan(
  tx: SqlExecutor,
  id: string,
  userId: string,
  chosen: readonly number[],
): Promise<boolean> {
  const rows = await tx`
    update ai_plans set status = 'approved', approved_by = ${userId}, approved_at = now(),
      updated_at = now()
    where id = ${id} and status = 'proposed'
    returning id`;
  if (rows.length === 0) return false;
  await tx`
    update ai_plan_steps set updated_at = now(),
      status = case when step_index in ${tx(chosen.length ? chosen : [-1])}
        then 'pending' else 'skipped' end
    where plan_id = ${id}`;
  return true;
}

/** Claims a pending step; false when another delivery of the job already took it. */
export async function claimStep(sql: SqlExecutor, id: string, index: number): Promise<boolean> {
  const rows = await sql`
    update ai_plan_steps set status = 'running', started_at = now(), updated_at = now()
    where plan_id = ${id} and step_index = ${index} and status = 'pending'
    returning step_index`;
  return rows.length > 0;
}

export async function finishStep(
  sql: SqlExecutor,
  id: string,
  index: number,
  outcome:
    | { status: 'done'; undo: unknown }
    | { status: 'failed'; error: string }
    | { status: 'skipped' | 'undone' },
): Promise<void> {
  const undo = outcome.status === 'done' ? (outcome.undo ?? null) : null;
  const error = outcome.status === 'failed' ? outcome.error : null;
  await sql`
    update ai_plan_steps set status = ${outcome.status}, updated_at = now(), finished_at = now(),
      undo = ${outcome.status === 'undone' ? null : JSON.stringify(undo)}::jsonb,
      error = ${error}
    where plan_id = ${id} and step_index = ${index}`;
}

/** Steps still waiting when a plan is cancelled are left out. */
export async function skipPending(sql: SqlExecutor, id: string): Promise<void> {
  await sql`
    update ai_plan_steps set status = 'skipped', updated_at = now()
    where plan_id = ${id} and status = 'pending'`;
}

/** The person a plan acts for, by name, for "via Bemmoly for <name>". */
export async function personName(sql: SqlExecutor, userId: string): Promise<string> {
  const [row] = await sql<{ name: string | null; email: string }[]>`
    select name, email from users where id = ${userId}`;
  return row?.name?.trim() || row?.email || 'a teammate';
}
