import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { UnauthenticatedError } from '@bemmoly/shared';
import type { RegisterRunnerResponse } from '../../../../shared/runner.ts';
import { HEARTBEAT_SECONDS, registerRunnerBodySchema } from '../../../../shared/runner.ts';
import { hashToken, newToken } from '../../utils/tokens.ts';

/*
 * Registering a runner. A pool token registers any number of runners, each taking whatever
 * the pool's queue offers. A launch token is minted for one machine Pipelines started for
 * one job: it registers exactly once, while that job still waits for it, and the runner it
 * makes claims that job alone and is retired when the job ends.
 */

type RegisterInput = ReturnType<typeof registerRunnerBodySchema.parse>;

async function insertRunner(
  tx: SqlExecutor,
  pool: { id: string; key: string },
  body: RegisterInput,
  launchId: string | null,
): Promise<RegisterRunnerResponse> {
  const runnerToken = newToken('runner');
  const [runner] = await tx<{ id: string }[]>`
    insert into pipeline_runners (pool_id, name, version, labels, state, last_heartbeat_at,
      token_hash, launch_id)
    values (${pool.id}, ${body.name}, ${body.version}, ${body.labels}::text[], 'idle', now(),
      ${hashToken(runnerToken)}, ${launchId}::uuid)
    returning id`;
  if (!runner) throw new UnauthenticatedError('The runner could not be registered');
  return { runnerId: runner.id, runnerToken, pool, heartbeatSeconds: HEARTBEAT_SECONDS };
}

async function registerLaunched(
  sql: SqlClient,
  body: RegisterInput,
  token: string,
): Promise<RegisterRunnerResponse> {
  return sql.begin(async (tx) => {
    const [launch] = await tx<{ id: string; pool_id: string; key: string }[]>`
      select l.id, l.pool_id, p.key from pipeline_runner_launches l
      join pipeline_runner_pools p on p.id = l.pool_id
      join pipeline_jobs j on j.id = l.job_id and j.launch_id = l.id and j.state = 'ready'
      where l.token_hash = ${hashToken(token)} and l.registered_at is null
        and l.state = 'starting' and l.token_expires_at > now()
      for update of l`;
    if (!launch) {
      throw new UnauthenticatedError(
        'This launch token was used already, has expired, or its job no longer waits; the machine can stop',
      );
    }
    await tx`
      update pipeline_runner_launches set state = 'running', registered_at = now(),
        updated_at = now()
      where id = ${launch.id}`;
    return insertRunner(tx, { id: launch.pool_id, key: launch.key }, body, launch.id);
  });
}

export async function registerRunner(
  sql: SqlClient,
  input: unknown,
): Promise<RegisterRunnerResponse> {
  const body = registerRunnerBodySchema.parse(input);
  if (body.launchToken) return registerLaunched(sql, body, body.launchToken);
  const [pool] = await sql<{ id: string; key: string }[]>`
    select id, key from pipeline_runner_pools
    where token_hash = ${hashToken(body.poolToken ?? '')}`;
  if (!pool)
    throw new UnauthenticatedError('That pool token is not valid; copy it again from Capacity');
  return insertRunner(sql, pool, body, null);
}

/**
 * Whether a launched runner's job is still there for it. When it is not (cancelled before the
 * machine came up, or handed to another machine), the runner is told to drain and exit.
 */
export async function launchedJobWaits(sql: SqlExecutor, launchId: string): Promise<boolean> {
  const [row] = await sql<{ waits: boolean }[]>`
    select exists(select 1 from pipeline_jobs
      where launch_id = ${launchId} and state = 'ready') as waits`;
  if (row?.waits) return true;
  await sql`
    update pipeline_runners set state = 'draining', updated_at = now()
    where launch_id = ${launchId} and state <> 'gone'`;
  return false;
}

/** A launched runner ends with its job: its token stops working and its machine is done. */
export async function retireLaunched(sql: SqlExecutor, runnerId: string | null): Promise<void> {
  if (!runnerId) return;
  const [runner] = await sql<{ launch_id: string | null }[]>`
    update pipeline_runners set state = 'gone', current_job_id = null, updated_at = now()
    where id = ${runnerId} and launch_id is not null
    returning launch_id`;
  if (!runner?.launch_id) return;
  await sql`
    update pipeline_runner_launches set state = 'finished', finished_at = now(), updated_at = now()
    where id = ${runner.launch_id} and state in ('starting', 'running')`;
}
