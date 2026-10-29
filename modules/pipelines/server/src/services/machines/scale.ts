import type { SqlExecutor } from '@bemmoly/core';
import { topicOf } from '../../../../shared/streams.ts';
import type { PodPoolSite, RunnersPart } from '../providers/runners-contract.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import {
  connectionOf,
  poolConfigOf,
  setPoolError,
  type MachinePoolRow,
  type PoolConfig,
} from './store.ts';
import type { MachinesDeps } from './types.ts';

/*
 * Pod pools (GKE Autopilot): each sweep prepares a pool that is not ready, or whose settings
 * changed, until its cluster, namespace and identity are in place, and sizes its warm room.
 * The pods themselves start one per job like any build machine, so a pool with no fewest
 * scales to zero with its queue; fewest keeps that many runners' worth of room warm while
 * fewer pods than that are up, so the next job's pod starts without waiting for a node.
 */

/** Warm room: what fewest asks for beyond the pods already up, never past the most. */
export function warmSize(
  pool: Pick<MachinePoolRow, 'min_runners' | 'max_runners' | 'live'>,
): number {
  return Math.max(0, Math.min(pool.min_runners, pool.max_runners) - pool.live);
}

type PodsState = NonNullable<PoolConfig['pods']>;

async function savePods(sql: SqlExecutor, poolId: string, before: unknown, pods: PodsState) {
  if (JSON.stringify(before) === JSON.stringify(pods)) return;
  await sql`
    update pipeline_runner_pools
    set config = config || ${JSON.stringify({ pods })}::jsonb, updated_at = now()
    where id = ${poolId}`;
  await publishStreamEvent(sql, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
}

function siteOf(pool: MachinePoolRow, config: PoolConfig): PodPoolSite | null {
  const settings = config.autopilot;
  if (!settings || !pool.account_external_id) return null;
  return {
    account: { externalId: pool.account_external_id, config: pool.account_config ?? {} },
    pool: pool.key,
    cluster: { location: settings.location, ...settings.cluster },
    namespace: settings.namespace,
    serviceAccount: settings.serviceAccount,
    size: { cpu: settings.cpu, memoryGb: settings.memoryGb, spot: settings.spot },
    warm: warmSize(pool),
  };
}

export async function preparePools(
  deps: MachinesDeps,
  pools: readonly MachinePoolRow[],
): Promise<{ scaled: number }> {
  const registry = await deps.providers();
  let scaled = 0;
  for (const pool of pools) {
    const connection = connectionOf(pool);
    const config = poolConfigOf(pool.config);
    const site = siteOf(pool, config);
    const runners: RunnersPart | undefined = registry
      .list()
      .find((provider) => provider.id === pool.provider)?.runners;
    if (!connection || !site || !runners?.ensurePool) continue;
    const key = JSON.stringify(site);
    const now = config.pods;
    try {
      if (now?.status !== 'ready' || now.prepared !== key) {
        const state = await runners.ensurePool(connection, site);
        await savePods(deps.sql, pool.id, now, {
          ref: state.ref,
          status: state.status,
          detail: state.detail,
          prepared: state.status === 'ready' ? key : null,
          warm: site.warm,
          ready: state.warm,
        });
        if (state.status === 'ready') scaled += 1;
      } else if (now.ref && runners.readPool && (site.warm > 0 || now.ready > 0)) {
        const { warm } = await runners.readPool(connection, {
          account: site.account,
          region: site.cluster.location,
          ref: now.ref,
        });
        await savePods(deps.sql, pool.id, now, { ...now, ready: warm });
      }
      await setPoolError(deps.sql, pool.id, null);
    } catch (error) {
      await setPoolError(deps.sql, pool.id, (error as Error).message);
    }
  }
  return { scaled };
}
