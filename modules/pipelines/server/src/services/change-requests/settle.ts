import type { SqlExecutor } from '@bemmoly/core';
import { recordActivity } from './activity.ts';

/*
 * A request's status follows the promotions it started. Called in the transaction that
 * finishes each promotion: while any is still open the request stays deploying; when all
 * succeeded it is deployed; if any ended another way (failed, rolled back, cancelled) it
 * failed, with that promotion's reason on its activity.
 */

export async function settleChangeRequest(
  tx: SqlExecutor,
  promotionId: string,
  now: Date,
): Promise<void> {
  const [link] = await tx<{ change_request_id: string | null }[]>`
    select change_request_id from pipeline_promotions where id = ${promotionId}`;
  if (link?.change_request_id) await settleRequest(tx, link.change_request_id, now);
}

/** The same check for one request, from the minute sweep in case a finish raced its start. */
export async function settleRequest(tx: SqlExecutor, requestId: string, now: Date) {
  const [request] = await tx<{ status: string; environment: string }[]>`
    select c.status, e.name as environment from pipeline_change_requests c
    join pipeline_environments e on e.id = c.environment_id
    where c.id = ${requestId} for update of c`;
  if (!request || request.status !== 'deploying') return;
  const promotions = await tx<{ state: string | null; outcome_reason: string | null }[]>`
    select p.state, p.outcome_reason from pipeline_change_request_items i
    left join pipeline_promotions p on p.id = i.promotion_id
    where i.change_request_id = ${requestId}`;
  const open = ['requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out'];
  // A service not linked yet is still being started.
  if (promotions.some((p) => p.state === null || open.includes(p.state))) return;
  const failed = promotions.find((p) => p.state !== 'succeeded');
  const status = failed ? 'failed' : 'deployed';
  await tx`
    update pipeline_change_requests set status = ${status},
      updated_at = ${now.toISOString()}::timestamptz
    where id = ${requestId}`;
  await recordActivity(
    tx,
    requestId,
    null,
    status,
    {
      environment: request.environment,
      ...(failed?.outcome_reason ? { note: failed.outcome_reason } : {}),
    },
    now,
  );
}
