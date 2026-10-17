import type { ChangeOutcome } from '../../../../../shared/trains.ts';
import type { PromotionRow } from '../../../models/shipping.ts';
import type { StoredPlan } from '../../rollout/plan.ts';
import { abortLiveDeployment } from '../deployments/actions.ts';
import type { ShippingEngineDeps } from '../engine-deps.ts';
import { startWave } from './waves.ts';

/*
 * A promotion while it rolls out (architecture §11): waves in order, each starting once the
 * previous one is healthy and its bake time has passed. One failing deployment stops the
 * promotion: its siblings still moving are rolled back too, and waves already finished
 * stay where they are, which is what the change record then says.
 */

const MINUTE = 60_000;
const LIVE = ['pending', 'deploying', 'canary', 'waiting'];

interface WaveRow {
  id: string;
  wave: number;
  state: string;
  reason: string | null;
  environment_key: string;
  finished_at: string | null;
}

export interface RolloutOutcome {
  finished?: ChangeOutcome;
  reason: string;
  nextCheck: Date | null;
}

export async function advanceRollout(
  deps: ShippingEngineDeps,
  promotion: PromotionRow,
  plan: StoredPlan,
  now: Date,
): Promise<RolloutOutcome> {
  const { sql } = deps;
  let wave = promotion.current_wave;
  for (let guard = 0; guard <= plan.waves.length; guard += 1) {
    if (wave === 0) {
      wave = plan.waves[0]?.wave ?? 1;
      await begin(deps, promotion, plan, wave, now);
    }
    const rows = await sql<WaveRow[]>`
      select d.id, d.wave, d.state, d.reason, e.key as environment_key, d.finished_at
      from pipeline_deployments d join pipeline_environments e on e.id = d.environment_id
      where d.promotion_id = ${promotion.id} order by d.wave, e.position`;
    const bad = rows.find((row) => row.state === 'rolled_back' || row.state === 'failed');
    if (bad) {
      for (const live of rows.filter((row) => LIVE.includes(row.state))) {
        await abortLiveDeployment(
          deps,
          live.id,
          `Stopped because ${bad.environment_key} did not finish`,
        );
      }
      const verb = bad.state === 'rolled_back' ? 'Rolled back' : 'Failed';
      return {
        finished: bad.state === 'rolled_back' ? 'rolled_back' : 'failed',
        reason: `${verb} in ${bad.environment_key}: ${bad.reason ?? 'see the deployment'}`,
        nextCheck: null,
      };
    }
    const current = rows.filter((row) => row.wave === wave);
    if (current.some((row) => LIVE.includes(row.state))) {
      return { reason: 'Rolling out', nextCheck: new Date(now.getTime() + MINUTE) };
    }
    const index = plan.waves.findIndex((w) => w.wave === wave);
    const next = plan.waves[index + 1];
    if (!next) {
      const places = [...new Set(rows.map((row) => row.environment_key))];
      return {
        finished: 'succeeded',
        reason: places.length > 0 ? `Live in ${places.join(', ')}` : 'Already running everywhere',
        nextCheck: null,
      };
    }
    const landed = Math.max(
      0,
      ...current.map((row) => (row.finished_at ? new Date(row.finished_at).getTime() : 0)),
    );
    const ready = (landed || now.getTime()) + (next.startsAfterMinutes ?? 0) * MINUTE;
    if (ready > now.getTime()) {
      return { reason: `Wave ${next.wave} starts after the bake time`, nextCheck: new Date(ready) };
    }
    wave = next.wave;
    await begin(deps, promotion, plan, wave, now);
  }
  return { reason: 'Rolling out', nextCheck: new Date(now.getTime() + MINUTE) };
}

async function begin(
  deps: ShippingEngineDeps,
  promotion: PromotionRow,
  plan: StoredPlan,
  wave: number,
  now: Date,
): Promise<void> {
  const ids = await deps.sql.begin(async (tx) => {
    const started = await startWave(tx, promotion, plan, wave, now);
    await tx`update pipeline_promotions set current_wave = ${wave} where id = ${promotion.id}`;
    return started;
  });
  for (const id of ids) await deps.wake('deployment', id, now);
}
