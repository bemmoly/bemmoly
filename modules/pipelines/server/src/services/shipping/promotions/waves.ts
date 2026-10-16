import type { SqlExecutor } from '@bemmoly/core';
import type { PromotionRow } from '../../../models/shipping.ts';
import { deploymentPlanFor, type StoredPlan } from '../../rollout/plan.ts';
import { recordDeploymentEvent } from '../record.ts';

/*
 * Starting one wave of a promotion: a deployment per environment in the wave, each knowing
 * the release and revision it replaces so a roll back has somewhere to go. An environment
 * that already runs this release needs no deployment.
 */

interface CurrentHere {
  environment_id: string;
  environment_key: string;
  release_id: string | null;
  revision: string | null;
}

export async function startWave(
  tx: SqlExecutor,
  promotion: PromotionRow,
  plan: StoredPlan,
  waveNumber: number,
  now: Date,
): Promise<string[]> {
  const wave = plan.waves.find((w) => w.wave === waveNumber);
  if (!wave) return [];
  const rows = await tx<CurrentHere[]>`
    select e.id as environment_id, e.key as environment_key, c.release_id,
      case when c.state in ('idle', 'failed', 'rolled_back') then d.revision end as revision
    from pipeline_environments e
    left join pipeline_current c on c.environment_id = e.id and c.application_id = ${promotion.application_id}
    left join pipeline_deployments d on d.id = c.deployment_id
    where e.key = any(${wave.environments}::text[])`;
  const ids: string[] = [];
  const settings = deploymentPlanFor(plan, wave);
  for (const here of rows) {
    if (here.release_id === promotion.release_id) continue;
    // A succeeded deployment's revision is the stable one; after a roll back the deployment
    // row names the failed revision, so look up the revision of the release that runs now.
    const [stable] = here.release_id
      ? await tx<{ revision: string | null }[]>`
          select revision from pipeline_deployments
          where application_id = ${promotion.application_id} and environment_id = ${here.environment_id}
            and release_id = ${here.release_id} and state = 'succeeded' and revision is not null
          order by finished_at desc nulls last limit 1`
      : [];
    const [created] = await tx<{ id: string }[]>`
      insert into pipeline_deployments
        (promotion_id, release_id, application_id, environment_id, kind, wave, state,
         previous_release_id, previous_revision, started_by, plan, phase, next_action_at)
      values (${promotion.id}, ${promotion.release_id}, ${promotion.application_id},
        ${here.environment_id}, 'deploy', ${waveNumber}, 'pending', ${here.release_id},
        ${stable?.revision ?? here.revision ?? null}, ${promotion.requested_by},
        ${JSON.stringify(settings)}::jsonb, 'deploy', ${now.toISOString()}::timestamptz)
      returning id`;
    if (!created) continue;
    await recordDeploymentEvent(
      tx,
      created.id,
      {
        state: 'pending',
        message: `Wave ${waveNumber} starts in ${here.environment_key}`,
        nextActionAt: now,
      },
      now,
    );
    ids.push(created.id);
  }
  return ids;
}
