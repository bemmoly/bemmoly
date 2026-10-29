import type { SqlExecutor } from '@bemmoly/core';
import type { RunnersPart } from '../providers/contract.ts';
import { connectionOf, poolConfigOf, setPoolError, type MachinePoolRow } from './store.ts';
import type { MachinesDeps } from './types.ts';

/*
 * Fleet pools (GKE Autopilot runner pools, once the provider has them): the size follows the
 * queue, every job claimed or waiting gets a runner, within the pool's fewest and most, so an
 * idle pool with no fewest goes to zero. The size is only sent when it changes.
 */

export function fleetSize(
  pool: Pick<MachinePoolRow, 'busy' | 'queued' | 'min_runners' | 'max_runners'>,
) {
  return Math.min(pool.max_runners, Math.max(pool.min_runners, pool.busy + pool.queued));
}

async function saveFleet(sql: SqlExecutor, poolId: string, fleet: { ref: string; size: number }) {
  await sql`
    update pipeline_runner_pools
    set config = config || ${JSON.stringify({ fleet })}::jsonb, updated_at = now()
    where id = ${poolId}`;
}

export async function scaleFleets(
  deps: MachinesDeps,
  pools: readonly MachinePoolRow[],
): Promise<{ scaled: number }> {
  const registry = await deps.providers();
  let scaled = 0;
  for (const pool of pools) {
    const connection = connectionOf(pool);
    // A fleet pool with no project is one whose runners people start; nothing to scale.
    if (!connection || !pool.account_external_id) continue;
    const runners: RunnersPart | undefined = registry
      .list()
      .find((provider) => provider.id === pool.provider)?.runners;
    if (!runners?.scale || !runners.ensurePool) continue;
    const size = fleetSize(pool);
    const fleet = poolConfigOf(pool.config).fleet;
    if (fleet?.size === size) continue;
    try {
      const ref =
        fleet?.ref ??
        (
          await runners.ensurePool(connection, {
            account: pool.account_external_id,
            name: pool.key,
            machine: 'default',
            min: pool.min_runners,
            max: pool.max_runners,
          })
        ).ref;
      await runners.scale(connection, { ref, size });
      await saveFleet(deps.sql, pool.id, { ref, size });
      await setPoolError(deps.sql, pool.id, null);
      scaled += 1;
    } catch (error) {
      await setPoolError(deps.sql, pool.id, (error as Error).message);
    }
  }
  return { scaled };
}
