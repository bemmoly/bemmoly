import type { SqlExecutor } from '@bemmoly/core';
import type { ChangeOutcome } from '../../../../../shared/trains.ts';
import { topicOf } from '../../../../../shared/streams.ts';
import { publishStreamEvent } from '../../streams/publish.ts';

/*
 * A promotion's last write (architecture §11): the final state, and an immutable change
 * record of what, who asked, who approved, every gate with its evidence, the timings and
 * the outcome, exported later as SOC 2 and ISO 27001 evidence. Written once; a second
 * finish of the same promotion is refused by the unique index and changes nothing.
 */

export async function finishPromotion(
  tx: SqlExecutor,
  promotionId: string,
  outcome: ChangeOutcome,
  reason: string,
  now: Date,
): Promise<void> {
  const at = now.toISOString();
  const [promotion] = await tx<
    {
      id: string;
      application_id: string;
      environment_id: string;
      release_id: string;
      requested_by: string | null;
      requester_name: string | null;
      created_at: string;
      approved_at: string | null;
      started_at: string | null;
      freeze_override: unknown;
      version: string;
      image_digests: Record<string, string>;
    }[]
  >`
    update pipeline_promotions p set state = ${outcome}, outcome_reason = ${reason},
      finished_at = ${at}::timestamptz, next_check_at = null, updated_at = ${at}::timestamptz
    from pipeline_releases r
    where p.id = ${promotionId} and r.id = p.release_id
      and p.state in ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')
    returning p.id, p.application_id, p.environment_id, p.release_id, p.requested_by,
      (select name from users where id = p.requested_by) as requester_name, p.created_at,
      p.approved_at, p.started_at, p.freeze_override, r.version, r.image_digests`;
  if (!promotion) return;
  const approvals = await tx`
    select a.id, a.user_id, u.name, a.requirement, a.decision, a.release_digest, a.comment,
      a.expires_at, a.created_at
    from pipeline_approvals a join users u on u.id = a.user_id
    where a.promotion_id = ${promotionId} order by a.created_at`;
  const gates = await tx`
    select gate, state, reason, evidence, recheck_at, evaluated_at
    from pipeline_gate_results where promotion_id = ${promotionId} order by created_at`;
  const deployments = await tx`
    select d.id, e.key as environment, d.wave, d.state, d.revision, d.previous_revision,
      d.reason, d.started_at, d.finished_at,
      (select count(*)::int from pipeline_canary_samples s where s.deployment_id = d.id) as samples
    from pipeline_deployments d join pipeline_environments e on e.id = d.environment_id
    where d.promotion_id = ${promotionId} order by d.wave, e.position`;
  const record = {
    release: {
      id: promotion.release_id,
      version: promotion.version,
      digests: promotion.image_digests,
    },
    requestedBy: promotion.requested_by
      ? { id: promotion.requested_by, name: promotion.requester_name ?? '' }
      : null,
    approvals,
    gates,
    deployments,
    freezeOverride: promotion.freeze_override ?? null,
    outcome,
    reason,
    timings: {
      requestedAt: promotion.created_at,
      approvedAt: promotion.approved_at,
      startedAt: promotion.started_at,
      finishedAt: at,
    },
  };
  await tx`
    insert into pipeline_change_records
      (promotion_id, application_id, environment_id, release_id, outcome, record, created_at)
    values (${promotionId}, ${promotion.application_id}, ${promotion.environment_id},
      ${promotion.release_id}, ${outcome}, ${JSON.stringify(record)}::jsonb, ${at}::timestamptz)
    on conflict (promotion_id) do nothing`;
  await publishPromotion(tx, promotionId, outcome);
}

export async function publishPromotion(tx: SqlExecutor, id: string, state: string): Promise<void> {
  const [row] = await tx<{ key: string }[]>`
    select a.key from pipeline_promotions p join pipeline_applications a on a.id = p.application_id
    where p.id = ${id}`;
  if (row) {
    await publishStreamEvent(tx, {
      topic: topicOf.application(row.key),
      kind: 'promotion.updated',
      data: { id, state },
    });
  }
  await publishStreamEvent(tx, { topic: topicOf.forYou(), kind: 'for-you.changed', data: {} });
}
