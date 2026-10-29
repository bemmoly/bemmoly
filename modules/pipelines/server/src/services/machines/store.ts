import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { z } from 'zod';
import { autopilotStatusSchema } from '../../../../shared/autopilot.ts';
import { cloudBuildMachineSchema } from '../../../../shared/machines.ts';
import type { Layout } from '../../../../shared/clouds.ts';
import type { Provider } from '../../../../shared/common.ts';
import { topicOf } from '../../../../shared/streams.ts';
import { advanceRun, wakeDispatch, type RunOutcome } from '../orchestrator/advance.ts';
import type { ConnectionRecord } from '../providers/contract.ts';
import { publishStreamEvent } from '../streams/publish.ts';

/* Reads and writes of pools Pipelines starts machines for, and of the machines themselves. */

/** Hostings where Pipelines starts one machine per job, and those it prepares a pool for. */
export const ONE_JOB_HOSTINGS = ['cloud-build', 'codebuild', 'gke-autopilot'] as const;
export const POD_HOSTINGS = ['gke-autopilot'] as const;

/**
 * What a pool keeps in its config: how a Cloud Build pool builds, how a GKE Autopilot pool
 * starts its pods, and how far that pool's preparation got (`prepared` is what was last
 * prepared, so a change to the pool prepares it again).
 */
export const poolConfigSchema = z.object({
  cloudBuild: z
    .object({
      region: z.string(),
      image: z.string(),
      machine: cloudBuildMachineSchema,
      serviceAccount: z.string(),
    })
    .optional(),
  autopilot: z
    .object({
      location: z.string(),
      cluster: z.object({ name: z.string(), create: z.boolean() }),
      image: z.string(),
      cpu: z.number(),
      memoryGb: z.number(),
      spot: z.boolean(),
      serviceAccount: z.string(),
      builderImage: z.string(),
      namespace: z.string(),
    })
    .optional(),
  pods: z
    .object({
      ref: z.string().nullable(),
      status: autopilotStatusSchema,
      detail: z.string().nullable(),
      prepared: z.string().nullable(),
      /** Warm room asked for, and how much is ready. */
      warm: z.number().int().min(0),
      ready: z.number().int().min(0),
    })
    .nullable()
    .optional(),
});

export type PoolConfig = z.infer<typeof poolConfigSchema>;

export const poolConfigOf = (raw: unknown): PoolConfig =>
  poolConfigSchema.catch({}).parse(raw ?? {});

/** Where a pool's machines run: Cloud Build's region, or the Autopilot cluster's location. */
export function regionOf(config: PoolConfig): string | null {
  return config.cloudBuild?.region ?? config.autopilot?.location ?? null;
}

export interface MachinePoolRow {
  id: string;
  key: string;
  hosting: string;
  min_runners: number;
  max_runners: number;
  config: unknown;
  account_external_id: string | null;
  account_config: Record<string, unknown> | null;
  connection_id: string | null;
  provider: string | null;
  connection_name: string | null;
  layout: string | null;
  boundary_ref: string | null;
  connection_config: Record<string, unknown> | null;
  /** When the oldest job with no machine yet became ready; null when none waits. */
  oldest: Date | string | null;
  busy: number;
  queued: number;
  /** Machines started for this pool that are still starting or running. */
  live: number;
}

export async function machinePools(
  sql: SqlExecutor,
  hostings: readonly string[],
  only?: readonly string[],
): Promise<MachinePoolRow[]> {
  return sql<MachinePoolRow[]>`
    select p.id, p.key, p.hosting, p.min_runners, p.max_runners, p.config,
      a.external_id as account_external_id, a.config as account_config,
      c.id as connection_id, c.provider, c.name as connection_name, c.layout, c.boundary_ref,
      c.config as connection_config,
      (select min(j.ready_at) from pipeline_jobs j where j.pool_id = p.id and j.state = 'ready'
        and j.launch_id is null) as oldest,
      (select count(*)::int from pipeline_jobs j where j.pool_id = p.id
        and j.state in ('claimed', 'running')) as busy,
      (select count(*)::int from pipeline_jobs j where j.pool_id = p.id and j.state = 'ready')
        as queued,
      (select count(*)::int from pipeline_runner_launches l where l.pool_id = p.id
        and l.state in ('starting', 'running')) as live
    from pipeline_runner_pools p
    left join cloud_accounts a on a.id = p.cloud_account_id
    left join cloud_connections c on c.id = a.connection_id
    where p.hosting = any(${[...hostings]}::text[])
      and (${only ? [...only] : null}::uuid[] is null or p.id = any(${only ? [...only] : null}::uuid[]))
    order by oldest nulls last, p.key`;
}

export function connectionOf(row: {
  connection_id: string | null;
  provider: string | null;
  connection_name: string | null;
  layout: string | null;
  boundary_ref: string | null;
  connection_config: Record<string, unknown> | null;
}): ConnectionRecord | null {
  if (!row.connection_id || !row.provider) return null;
  return {
    id: row.connection_id,
    provider: row.provider as Provider,
    name: row.connection_name ?? '',
    layout: (row.layout ?? 'per-environment') as Layout,
    boundaryRef: row.boundary_ref,
    config: row.connection_config ?? {},
  };
}

export async function setPoolError(sql: SqlExecutor, poolId: string, error: string | null) {
  const changed = await sql`
    update pipeline_runner_pools set last_error = ${error}, updated_at = now()
    where id = ${poolId} and last_error is distinct from ${error}
    returning id`;
  if (changed.length > 0) {
    await publishStreamEvent(sql, {
      topic: topicOf.capacity(),
      kind: 'capacity.updated',
      data: {},
    });
  }
}

export async function recordStarted(
  sql: SqlExecutor,
  launchId: string,
  started: { ref: string; logUrl: string | null },
) {
  await sql`
    update pipeline_runner_launches set external_ref = ${started.ref}, log_url = ${started.logUrl},
      updated_at = now()
    where id = ${launchId}`;
}

/**
 * A machine's end. `release` hands its job back to the queue for another machine, when the
 * job never started on this one.
 */
export async function endLaunch(
  sql: SqlClient,
  launchId: string,
  outcome: { state: 'finished' | 'failed' | 'cancelled'; error?: string; release?: boolean },
) {
  await sql.begin(async (tx) => {
    await tx`
      update pipeline_runner_launches set state = ${outcome.state}, error = ${outcome.error ?? null},
        finished_at = now(), updated_at = now()
      where id = ${launchId} and state in ('starting', 'running')`;
    if (outcome.release) {
      const released = await tx<{ pool_id: string | null }[]>`
        update pipeline_jobs set launch_id = null, updated_at = now()
        where launch_id = ${launchId} and state = 'ready'
        returning pool_id`;
      await wakeDispatch(
        tx,
        released.map((job) => job.pool_id),
      );
    }
    await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
  });
}

/** Fails a job its machine could not run, with the sentence a person reads on the run. */
export async function failJob(
  sql: SqlClient,
  jobId: string,
  summary: string,
): Promise<RunOutcome | null> {
  return sql.begin(async (tx) => {
    const [job] = await tx<{ id: string; run_id: string }[]>`
      update pipeline_jobs set state = 'failed', finished_at = now(), updated_at = now(),
        failure_summary = ${summary},
        token_expires_at = least(token_expires_at, now() + interval '15 minutes')
      where id = ${jobId} and state in ('ready', 'claimed', 'running')
      returning id, run_id`;
    if (!job) return null;
    await tx`
      update pipeline_steps set state = case when state = 'running' then 'failed' else 'skipped' end,
        finished_at = case when state = 'running' then now() else finished_at end,
        updated_at = now()
      where job_id = ${jobId} and state in ('pending', 'running')`;
    await publishStreamEvent(tx, {
      topic: topicOf.run(job.run_id),
      kind: 'job.updated',
      data: { id: job.id, runId: job.run_id, state: 'failed' },
    });
    await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
    return advanceRun(tx, job.run_id);
  });
}
