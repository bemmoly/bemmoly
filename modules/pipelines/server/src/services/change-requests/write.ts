import type { RequestContext, SqlExecutor } from '@bemmoly/core';
import { ConflictError, ForbiddenError, ValidationError } from '@bemmoly/shared';
import type {
  ChangeRisk,
  ChangeWhen,
  CreateChangeRequestBody,
} from '../../../../shared/change-requests.ts';
import type { ChangeEnvironmentRow } from '../../models/change-requests.ts';
import { authorizePipelines } from '../deps.ts';
import { notify, recordActivity, type NotifyDeps } from './activity.ts';
import { resolveItems, type ResolvedItem } from './items.ts';
import { loadPicks, loadSteps } from './rows.ts';
import { checkPicks, routeOf, type StepPicks } from './route.ts';

/*
 * Writing a request: its items, and the route copied from the environment's rule at that
 * moment with the people picked for each step. Sending opens the first step and tells the
 * people picked for it; later steps open in turn as each one is approved.
 */

export interface Draft {
  title: string;
  why: string;
  risk: ChangeRisk;
  when: ChangeWhen;
  rollback: string;
  items: ReadonlyArray<{ application: string; releaseId: string }>;
  picks: ReadonlyArray<{ step: number; users: readonly string[] }>;
}

/** May this person deploy here: anyone whose role deploys, unless the environment names who. */
export async function requireDeployer(
  ctx: RequestContext,
  sql: SqlExecutor,
  environment: ChangeEnvironmentRow,
  userId: string,
): Promise<void> {
  await authorizePipelines(ctx, 'pipelines.deploy');
  const named = environment.deployers;
  if (!named) return;
  if ((named.users ?? []).includes(userId)) return;
  const groups = named.groups ?? [];
  const [member] = groups.length
    ? await sql<{ n: number }[]>`
        select count(*)::int as n from pipeline_approval_group_members
        where user_id = ${userId} and group_id = any(${groups}::uuid[])`
    : [];
  if ((member?.n ?? 0) > 0) return;
  throw new ForbiddenError(`Only the people ${environment.name} names may deploy there`);
}

/** The picks a stored request carries, in the shape a body sends them. */
export async function storedPicks(
  sql: SqlExecutor,
  requestId: string,
): Promise<Array<{ step: number; users: string[] }>> {
  const [steps, picks] = await Promise.all([loadSteps(sql, requestId), loadPicks(sql, requestId)]);
  return steps.map((step) => ({
    step: step.position,
    users: picks.filter((pick) => pick.step_id === step.id).map((pick) => pick.user_id),
  }));
}

export interface Prepared {
  items: ResolvedItem[];
  picks: StepPicks[];
}

export async function prepare(
  sql: SqlExecutor,
  environment: ChangeEnvironmentRow,
  draft: Draft,
  requester: string,
  sending: boolean,
  now: Date,
): Promise<Prepared> {
  if (!environment.approval_rule) {
    throw new ValidationError(
      `${environment.name} has no approval rule, so versions deploy there directly`,
    );
  }
  const past = draft.when.kind === 'at' && new Date(draft.when.at).getTime() < now.getTime();
  if (sending && past) {
    throw new ValidationError('Pick a time that has not passed yet');
  }
  const items = await resolveItems(sql, environment, draft.items);
  const route = await routeOf(sql, environment, draft.risk);
  const picks = await checkPicks(sql, route, draft.picks, requester, sending);
  return { items, picks };
}

/** Replaces the request's items and route; earlier decisions go with the old route. */
export async function writeChildren(
  tx: SqlExecutor,
  requestId: string,
  prepared: Prepared,
  sending: boolean,
  at: string,
): Promise<void> {
  await tx`delete from pipeline_change_request_items where change_request_id = ${requestId}`;
  await tx`delete from pipeline_change_request_steps where change_request_id = ${requestId}`;
  for (const item of prepared.items) {
    await tx`
      insert into pipeline_change_request_items
        (change_request_id, application_id, release_id, from_release_id, created_at, updated_at)
      values (${requestId}, ${item.applicationId}, ${item.releaseId}, ${item.fromReleaseId},
        ${at}::timestamptz, ${at}::timestamptz)`;
  }
  let first = true;
  for (const { step, users } of prepared.picks) {
    const state = sending && first ? 'waiting' : 'queued';
    first = false;
    const [row] = await tx<{ id: string }[]>`
      insert into pipeline_change_request_steps
        (change_request_id, position, group_id, group_name, count, condition, state,
         created_at, updated_at)
      values (${requestId}, ${step.position}, ${step.groupId}, ${step.groupName}, ${step.count},
        ${step.when}, ${state}, ${at}::timestamptz, ${at}::timestamptz)
      returning id`;
    if (!row) throw new Error('The approval step was not recorded');
    for (const user of users) {
      await tx`
        insert into pipeline_change_request_picks (step_id, user_id, created_at, updated_at)
        values (${row.id}, ${user}, ${at}::timestamptz, ${at}::timestamptz)`;
    }
  }
}

export async function insertRequest(
  tx: SqlExecutor,
  environment: ChangeEnvironmentRow,
  body: CreateChangeRequestBody,
  requester: string,
  status: string,
  at: string,
): Promise<{ id: string; number: string }> {
  const [row] = await tx<{ id: string; number: string }[]>`
    insert into pipeline_change_requests
      (environment_id, title, why, risk, deploy_at, rollback, status, requested_by,
       emergency_reason, sent_at, decided_at, created_at, updated_at)
    values (${environment.id}, ${body.title}, ${body.why}, ${body.risk},
      ${body.when.kind === 'at' ? body.when.at : null}::timestamptz, ${body.rollback}, ${status},
      ${requester}, ${body.emergency?.reason ?? null},
      ${status === 'draft' ? null : at}::timestamptz,
      ${status === 'approved' ? at : null}::timestamptz, ${at}::timestamptz, ${at}::timestamptz)
    returning id, number::text as number`;
  if (!row) throw new Error('The change request was not recorded');
  return row;
}

/** Opens the request: the first step waits, and the people picked for it hear of it. */
export async function announceSent(
  deps: NotifyDeps,
  ctx: RequestContext,
  tx: SqlExecutor,
  request: { id: string; number: string; title: string },
  prepared: Prepared,
  requester: string,
  at: Date,
): Promise<void> {
  const names = await tx<{ id: string; name: string }[]>`
    select id, name from users
    where id = any(${prepared.picks.flatMap((p) => p.users)}::uuid[])`;
  const nameOf = new Map(names.map((row) => [row.id, row.name]));
  await recordActivity(
    tx,
    request.id,
    requester,
    'sent',
    { picked: [...new Set(prepared.picks.flatMap((p) => p.users))].map((id) => nameOf.get(id)) },
    at,
  );
  const first = prepared.picks[0];
  if (!first) return;
  await notify(deps, ctx, tx, request, {
    kind: 'review_request',
    recipientIds: first.users,
    body: `You were picked to approve it as one of ${first.step.groupName}.`,
    dedupeKey: `change-request:${request.id}:step:${first.step.position}:${at.toISOString()}`,
  });
}

/** Only drafts and requests sent back for changes may be edited or sent. */
export function requireEditable(status: string): void {
  if (status !== 'draft' && status !== 'changes_requested') {
    throw new ConflictError('Only a draft, or a request sent back for changes, can change');
  }
}
