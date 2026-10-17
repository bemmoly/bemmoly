import { createRolloutEngine } from './deployments/engine.ts';
import type { ShippingEngineDeps, WakeKind } from './engine-deps.ts';
import { createPromotionEngine } from './promotions/engine.ts';

/*
 * The shipping engine as jobs see it: advance one promotion or deployment, or sweep every
 * one that is due. Wake-ups normally arrive as jobs at the right moment; the sweep runs each
 * minute so a lost wake-up only ever costs a minute.
 */

export function createShippingEngine(deps: ShippingEngineDeps) {
  const rollouts = createRolloutEngine(deps);
  const promotions = createPromotionEngine(deps);

  async function advance(kind: WakeKind, id: string, force = false): Promise<void> {
    if (kind === 'deployment') await rollouts.advance(id);
    else await promotions.advance(id, { force });
  }

  return {
    advance,
    promotions,
    rollouts,
    /** Everything due now, deployments first so promotions see their latest state. */
    async sweep(limit = 200): Promise<number> {
      const now = deps.now().toISOString();
      const deployments = await deps.sql<{ id: string }[]>`
        select id from pipeline_deployments
        where state in ('pending', 'deploying', 'canary') and next_action_at <= ${now}::timestamptz
        order by next_action_at limit ${limit}`;
      for (const { id } of deployments) await rollouts.advance(id);
      const due = await deps.sql<{ id: string }[]>`
        select id from pipeline_promotions
        where state in ('requested', 'gating', 'awaiting_approval', 'scheduled', 'rolling_out')
          and next_check_at <= ${now}::timestamptz
        order by next_check_at limit ${limit}`;
      for (const { id } of due) await promotions.advance(id);
      return deployments.length + due.length;
    },
  };
}

export type ShippingEngine = ReturnType<typeof createShippingEngine>;
