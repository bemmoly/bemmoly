import type { SqlExecutor } from '@bemmoly/core';
import {
  finishPromotion,
  publishPromotion,
} from '../../server/src/services/shipping/promotions/finish.ts';
import { recordDeploymentEvent } from '../../server/src/services/shipping/record.ts';
import type { Action, SimDeployment } from './model.ts';

/*
 * Deployments and promotions in the database. Every state change goes through
 * recordDeploymentEvent, the one way a deployment moves: the row, its append-only event
 * (which the map rewinds from) and pipeline_current change together and the map, the
 * application and the deployment page hear it. Promotions end through finishPromotion, so a
 * simulated change leaves the same change record a real one does.
 *
 * The real shipping engine owns rows with a due time (next_action_at, next_check_at); the
 * simulator only moves rows without one, so the two never fight over a deployment.
 */

const LIVE = ['pending', 'deploying', 'canary', 'waiting'];
const OPEN = ['requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out'];

const PLAN = {
  waves: [
    { wave: 1, environments: ['prod-asia-south1'], steps: [5, 25, 100], holdMinutes: 1 },
    { wave: 2, environments: ['prod-us-east1', 'prod-eu-west1'] },
  ],
  autoRollback: true,
  simulator: true,
};

const GATES: readonly (readonly [string, string])[] = [
  ['tests', '118 tests, 0 failed'],
  ['security_scan', '0 high findings'],
  ['staging_healthy', 'Healthy for 34 minutes, needs 30'],
  ['error_budget', '58% left this month'],
  ['window', 'Open until 16:00'],
  ['freeze', 'No freeze this week'],
];

async function insertDeployment(
  tx: SqlExecutor,
  d: SimDeployment,
  startedBy: string | null,
  wave: number,
  now: Date,
): Promise<boolean> {
  const [taken] = await tx`
    select 1 from pipeline_deployments
    where application_id = ${d.appId} and environment_id = ${d.envId}
      and state = any(${LIVE}::text[])
    limit 1`;
  if (taken) return false;
  const [current] = await tx<{ release_id: string | null }[]>`
    select release_id from pipeline_current
    where application_id = ${d.appId} and environment_id = ${d.envId}`;
  await tx`
    insert into pipeline_deployments (id, promotion_id, release_id, application_id,
      environment_id, kind, wave, state, previous_release_id, started_by, plan, phase)
    values (${d.id}, ${d.promotionId}::uuid, ${d.releaseId}, ${d.appId}, ${d.envId}, 'deploy',
      ${wave}, 'pending', ${current?.release_id ?? null}::uuid, ${startedBy}::uuid,
      ${JSON.stringify({ simulator: true, steps: d.steps })}::jsonb, 'deploy')`;
  await recordDeploymentEvent(
    tx,
    d.id,
    { state: 'pending', message: `${d.version} queued to deploy`, phase: 'deploy' },
    now,
  );
  return true;
}

async function insertAll(
  tx: SqlExecutor,
  deployments: readonly SimDeployment[],
  startedBy: string | null,
  wave: number,
  now: Date,
) {
  let any = false;
  for (const d of deployments) any = (await insertDeployment(tx, d, startedBy, wave, now)) || any;
  return any;
}

async function ownPromotion(tx: SqlExecutor, id: string, states: readonly string[]) {
  const [row] = await tx<{ requested_by: string | null; release_digest: string | null }[]>`
    select requested_by, release_digest from pipeline_promotions
    where id = ${id} and state = any(${states}::text[]) and next_check_at is null
    for update`;
  return row ?? null;
}

export async function executeShipping(tx: SqlExecutor, action: Action, now: Date) {
  const at = now.toISOString();
  switch (action.kind) {
    case 'job.finish':
      // A busy Dev keeps the release where it is; the run itself still finished.
      if (action.deployment) await insertDeployment(tx, action.deployment, null, 1, now);
      return true;
    case 'deployment.start':
      return insertDeployment(tx, action.deployment, action.startedBy, 1, now);
    case 'deployment.step': {
      const [row] = await tx`
        select 1 from pipeline_deployments
        where id = ${action.deploymentId} and state = any(${LIVE}::text[])
          and next_action_at is null
        for update`;
      if (!row) return false;
      const done = ['succeeded', 'failed', 'rolled_back'].includes(action.state);
      const failed = action.state === 'failed' || action.state === 'rolled_back';
      await recordDeploymentEvent(
        tx,
        action.deploymentId,
        {
          state: action.state,
          message: action.message,
          traffic: action.traffic,
          phase: done ? 'done' : action.state === 'canary' ? 'step' : 'deploy',
          ...(failed ? { reason: action.message } : {}),
        },
        now,
      );
      return true;
    }
    case 'promotion.request': {
      const { promotion } = action;
      const [open] = await tx`
        select 1 from pipeline_promotions
        where application_id = ${promotion.appId} and state = any(${OPEN}::text[]) limit 1`;
      const [release] = await tx<{ digest: string | null }[]>`
        select (select value from jsonb_each_text(image_digests) limit 1) as digest
        from pipeline_releases where id = ${promotion.releaseId}`;
      const [prod] = await tx<{ id: string }[]>`
        select id from pipeline_environments where class = 'prod' and archived_at is null
        order by position limit 1`;
      if (open || !release || !prod) return false;
      await tx`
        insert into pipeline_promotions (id, release_id, application_id, environment_id, mode,
          state, plan, requested_by, release_digest, expires_at)
        values (${promotion.id}, ${promotion.releaseId}, ${promotion.appId}, ${prod.id},
          'approval', 'awaiting_approval', ${JSON.stringify(PLAN)}::jsonb, ${action.requestedBy}::uuid,
          ${release.digest ?? 'sha256:unknown'}, ${at}::timestamptz + interval '8 hours')`;
      const gates = [
        ...GATES.map(([gate, reason]) => ({ gate, state: 'pass', reason })),
        { gate: 'approvals', state: 'pending', reason: 'Waiting for approvals' },
      ].map((g) => ({ promotion_id: promotion.id, ...g, evaluated_at: at }));
      await tx`insert into pipeline_gate_results ${tx(gates)}`;
      await publishPromotion(tx, promotion.id, 'awaiting_approval');
      return true;
    }
    case 'promotion.approve': {
      const row = await ownPromotion(tx, action.promotionId, ['awaiting_approval']);
      if (!row) return false;
      if (action.approverId && action.approverId !== row.requested_by) {
        await tx`
          insert into pipeline_approvals (promotion_id, user_id, requirement, decision,
            release_digest)
          values (${action.promotionId}, ${action.approverId}, 'owning_team', 'approved',
            ${row.release_digest ?? 'sha256:unknown'})
          on conflict (promotion_id, user_id) do nothing`;
      }
      await tx`update pipeline_gate_results set state = 'pass', reason = 'Approved',
        evaluated_at = ${at}::timestamptz
        where promotion_id = ${action.promotionId} and gate = 'approvals'`;
      await tx`
        update pipeline_promotions set state = 'rolling_out', current_wave = 1,
          approved_at = ${at}::timestamptz, started_at = ${at}::timestamptz,
          updated_at = ${at}::timestamptz
        where id = ${action.promotionId}`;
      if (!(await insertAll(tx, action.deployments, row.requested_by, 1, now))) return false;
      await publishPromotion(tx, action.promotionId, 'rolling_out');
      return true;
    }
    case 'promotion.wave': {
      const row = await ownPromotion(tx, action.promotionId, ['rolling_out']);
      if (!row) return false;
      await tx`update pipeline_promotions set current_wave = ${action.wave},
        updated_at = ${at}::timestamptz where id = ${action.promotionId}`;
      if (!(await insertAll(tx, action.deployments, row.requested_by, action.wave, now)))
        return false;
      await publishPromotion(tx, action.promotionId, 'rolling_out');
      return true;
    }
    case 'promotion.finish': {
      if (!(await ownPromotion(tx, action.promotionId, OPEN))) return false;
      await finishPromotion(tx, action.promotionId, action.outcome, action.reason, now);
      return true;
    }
    default:
      return true;
  }
}
