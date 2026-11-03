import type { RequestContext, SqlClient, SqlExecutor } from '@bemmoly/core';
import { ConflictError, ForbiddenError } from '@bemmoly/shared';
import type { ChangeRequestRow, ChangeRequestStepRow } from '../../models/change-requests.ts';
import { authorizePipelines, requirePerson } from '../deps.ts';
import { notify, recordActivity, type NotifyDeps } from './activity.ts';
import { loadPicks, loadRequest, loadSteps } from './rows.ts';

/*
 * Decisions on a sent request. Steps go in order: only the people picked for the step that
 * is open may decide, once each, and never the person who asked. When a step has its
 * approvals the next opens; when the last does, the request is approved and its deploy
 * starts by itself. A rejection ends it; asking for changes hands it back to the requester.
 */

export interface DecideDeps extends NotifyDeps {
  sql: SqlClient;
}

interface Turn {
  request: ChangeRequestRow;
  step: ChangeRequestStepRow;
}

/** The open step and proof that this person may decide on it now. */
async function turnOf(tx: SqlExecutor, number: string, person: string): Promise<Turn> {
  const request = await loadRequest(tx, { number }, true);
  if (request.status !== 'waiting') {
    throw new ConflictError(`CHG-${request.number} is not waiting for approval`);
  }
  if (request.requested_by === person) {
    throw new ForbiddenError('Nobody approves their own change');
  }
  const steps = await loadSteps(tx, request.id);
  const step = steps.find((s) => s.state === 'waiting');
  if (!step) throw new ConflictError(`CHG-${request.number} has no step open`);
  const picks = await loadPicks(tx, request.id);
  if (!picks.some((pick) => pick.step_id === step.id && pick.user_id === person)) {
    throw new ForbiddenError(`Only the people picked from ${step.group_name} decide this step`);
  }
  const [already] = await tx<{ n: number }[]>`
    select count(*)::int as n from pipeline_change_request_approvals
    where step_id = ${step.id} and user_id = ${person}`;
  if ((already?.n ?? 0) > 0) throw new ConflictError('You already decided on this step');
  return { request, step };
}

async function record(
  tx: SqlExecutor,
  stepId: string,
  person: string,
  decision: string,
  note: string | null,
  at: string,
) {
  await tx`
    insert into pipeline_change_request_approvals
      (step_id, user_id, decision, note, created_at, updated_at)
    values (${stepId}, ${person}, ${decision}, ${note}, ${at}::timestamptz, ${at}::timestamptz)`;
}

/** Returns whether the request is now fully approved. */
export async function approve(
  deps: DecideDeps,
  ctx: RequestContext,
  number: string,
  note: string | null,
): Promise<{ id: string; approved: boolean }> {
  await authorizePipelines(ctx);
  const person = requirePerson(ctx.actor);
  const now = deps.now();
  const at = now.toISOString();
  return deps.sql.begin(async (tx) => {
    const { request, step } = await turnOf(tx, number, person);
    await record(tx, step.id, person, 'approved', note, at);
    await recordActivity(tx, request.id, person, 'approved', { group: step.group_name, note }, now);
    const [got] = await tx<{ n: number }[]>`
      select count(*)::int as n from pipeline_change_request_approvals
      where step_id = ${step.id} and decision = 'approved'`;
    if ((got?.n ?? 0) < step.count) return { id: request.id, approved: false };
    await tx`update pipeline_change_request_steps set state = 'approved',
      updated_at = ${at}::timestamptz where id = ${step.id}`;
    const next = (await loadSteps(tx, request.id)).find((s) => s.state === 'queued');
    if (next) {
      await tx`update pipeline_change_request_steps set state = 'waiting',
        updated_at = ${at}::timestamptz where id = ${next.id}`;
      await recordActivity(tx, request.id, null, 'step_ready', { group: next.group_name }, now);
      const picks = await loadPicks(tx, request.id);
      await notify(deps, ctx, tx, request, {
        kind: 'review_request',
        recipientIds: picks.filter((p) => p.step_id === next.id).map((p) => p.user_id),
        body: `You were picked to approve it as one of ${next.group_name}.`,
        dedupeKey: `change-request:${request.id}:step:${next.position}:${at}`,
      });
      return { id: request.id, approved: false };
    }
    await tx`update pipeline_change_requests set status = 'approved',
      decided_at = ${at}::timestamptz, updated_at = ${at}::timestamptz
      where id = ${request.id}`;
    await recordActivity(tx, request.id, null, 'all_approved', {}, now);
    if (request.requested_by) {
      await notify(deps, ctx, tx, request, {
        kind: 'status_change',
        recipientIds: [request.requested_by],
        body: `Approved. It deploys to ${request.environment_name} by itself.`,
        dedupeKey: `change-request:${request.id}:approved`,
      });
    }
    return { id: request.id, approved: true };
  });
}

export async function reject(
  deps: DecideDeps,
  ctx: RequestContext,
  number: string,
  kind: 'reject' | 'changes_requested',
  note: string,
): Promise<string> {
  await authorizePipelines(ctx);
  const person = requirePerson(ctx.actor);
  const now = deps.now();
  const at = now.toISOString();
  return deps.sql.begin(async (tx) => {
    const { request, step } = await turnOf(tx, number, person);
    const decision = kind === 'reject' ? 'rejected' : 'changes_requested';
    await record(tx, step.id, person, decision, note, at);
    if (kind === 'reject') {
      await tx`update pipeline_change_request_steps set state = 'rejected',
        updated_at = ${at}::timestamptz where id = ${step.id}`;
    }
    await tx`update pipeline_change_requests set status = ${kind === 'reject' ? 'rejected' : 'changes_requested'},
      decided_at = ${kind === 'reject' ? at : null}::timestamptz, updated_at = ${at}::timestamptz
      where id = ${request.id}`;
    await recordActivity(tx, request.id, person, decision, { group: step.group_name, note }, now);
    if (request.requested_by) {
      await notify(deps, ctx, tx, request, {
        kind: 'status_change',
        recipientIds: [request.requested_by],
        body: kind === 'reject' ? `Rejected: ${note}` : `Changes asked for: ${note}`,
        dedupeKey: `change-request:${request.id}:${decision}:${at}`,
      });
    }
    return request.id;
  });
}

const WITHDRAWABLE = new Set(['draft', 'waiting', 'changes_requested', 'approved']);

/** The person who asked, or a Platform admin, takes it back before it deploys. */
export async function withdraw(
  deps: DecideDeps,
  ctx: RequestContext,
  number: string,
  reason: string | null,
): Promise<string> {
  await authorizePipelines(ctx);
  const person = requirePerson(ctx.actor);
  const now = deps.now();
  const at = now.toISOString();
  const request = await loadRequest(deps.sql, { number });
  if (request.requested_by !== person) await authorizePipelines(ctx, 'pipelines.platform.admin');
  return deps.sql.begin(async (tx) => {
    const locked = await loadRequest(tx, { id: request.id }, true);
    if (!WITHDRAWABLE.has(locked.status)) {
      throw new ConflictError(`CHG-${locked.number} can no longer be withdrawn`);
    }
    await tx`update pipeline_change_requests set status = 'withdrawn',
      decided_at = ${at}::timestamptz, updated_at = ${at}::timestamptz where id = ${locked.id}`;
    await recordActivity(tx, locked.id, person, 'withdrawn', { note: reason }, now);
    const steps = await loadSteps(tx, locked.id);
    const open = steps.find((s) => s.state === 'waiting');
    if (open && locked.status === 'waiting') {
      const picks = await loadPicks(tx, locked.id);
      await notify(deps, ctx, tx, locked, {
        kind: 'status_change',
        recipientIds: picks.filter((p) => p.step_id === open.id).map((p) => p.user_id),
        body: 'Withdrawn. Nothing is waiting for you on it any more.',
        dedupeKey: `change-request:${locked.id}:withdrawn`,
      });
    }
    return locked.id;
  });
}
