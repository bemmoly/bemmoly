import type { SendJobOptions } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import { requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import type { RunOutcome } from '../orchestrator/advance.ts';
import type { ProviderSource } from '../providers/index.ts';
import type { ProviderRegistry } from '../providers/registry.ts';
import { followMachines } from './follow.ts';
import { scaleFleets } from './scale.ts';
import { startMachines } from './start.ts';
import { FLEET_HOSTINGS, machinePools, ONE_JOB_HOSTINGS } from './store.ts';

export { poolConfigOf, ONE_JOB_HOSTINGS } from './store.ts';

/*
 * The autoscaler (Platform › Capacity, journeys proposal "who gives the infra"): reads each
 * pool's queue and starts what it needs. One-job pools get a machine per waiting job, up to
 * their most; fleet pools are scaled to the queue within their fewest and most. A minute
 * sweep covers every pool; a job becoming ready in a one-job pool starts its machine within
 * seconds through a short-lived start job. Every step is safe with several servers sweeping.
 */

export const MACHINES_SWEEP_JOB = 'pipelines.machines-sweep';
export const MACHINES_START_JOB = 'pipelines.machines-start';
/** Wake-ups in one window share one start job, which runs when the window closes. */
const START_WINDOW_MS = 3_000;
const POOL_CACHE_MS = 30_000;

export interface MachinesServiceDeps extends PipelinesServiceDeps {
  providers: ProviderRegistry | ProviderSource;
  publicUrl?: string;
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
  announce: (outcomes: readonly RunOutcome[]) => Promise<void>;
}

export interface MachinesSweep {
  followed: number;
  started: number;
  scaled: number;
}

export function createMachinesService(deps: MachinesServiceDeps) {
  const source = deps.providers;
  const providers: ProviderSource = typeof source === 'function' ? source : async () => source;
  let oneJob: { ids: Set<string>; at: number } | null = null;
  const context = () => ({
    sql: requireDatabase(deps),
    providers,
    announce: deps.announce,
    ...(deps.publicUrl ? { publicUrl: deps.publicUrl } : {}),
  });

  return {
    /** Every pool, or only the pools named, which skips following and fleets. */
    async sweep(options: { pools?: readonly string[] } = {}): Promise<MachinesSweep> {
      const ctx = context();
      const followed = options.pools
        ? { followed: 0, outcomes: [], errors: [] }
        : await followMachines(ctx);
      const started = await startMachines(
        ctx,
        await machinePools(ctx.sql, ONE_JOB_HOSTINGS, options.pools),
      );
      const fleets = options.pools
        ? { scaled: 0 }
        : await scaleFleets(ctx, await machinePools(ctx.sql, FLEET_HOSTINGS));
      await deps.announce([...followed.outcomes, ...started.outcomes]);
      if (followed.errors.length > 0) {
        throw new ProviderError(
          `${followed.errors.length} build machines could not be checked and wait for the next sweep: ${followed.errors[0]}`,
        );
      }
      return { followed: followed.followed, started: started.started, scaled: fleets.scaled };
    },

    /** A job became ready in a pool: if Pipelines starts that pool's machines, start one soon. */
    async kick(poolId: string): Promise<void> {
      if (!deps.sendJob || !deps.database) return;
      if (!oneJob || Date.now() - oneJob.at > POOL_CACHE_MS) {
        const rows = await deps.database<{ id: string }[]>`
          select id from pipeline_runner_pools where hosting = any(${[...ONE_JOB_HOSTINGS]}::text[])`;
        oneJob = { ids: new Set(rows.map((row) => row.id)), at: Date.now() };
      }
      if (!oneJob.ids.has(poolId)) return;
      const window = Math.floor(Date.now() / START_WINDOW_MS);
      const closes = new Date((window + 1) * START_WINDOW_MS);
      await deps.sendJob(
        MACHINES_START_JOB,
        { poolId },
        { idempotencyKey: `machines:${poolId}:${window}`, startAfter: closes },
      );
    },
  };
}

export type MachinesService = ReturnType<typeof createMachinesService>;
