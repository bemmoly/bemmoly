import type { RunOutcome } from '../orchestrator/advance.ts';
import type { MachineRef, RunnersPart } from '../providers/contract.ts';
import { connectionOf, endLaunch, failJob, poolConfigOf, regionOf } from './store.ts';
import type { MachinesDeps } from './types.ts';

/*
 * Following machines already started. Each sweep leases the live ones it has not asked about
 * recently (so two servers never ask about one machine at once) and settles what changed: a
 * machine whose job ended or moved on is stopped and closed; one that never came up gives
 * its job back to the queue; one that ended while its job still waited or ran fails the job
 * with the cloud's reason, and is stopped in case the cloud would keep it (a pod whose image
 * cannot be pulled waits otherwise until its deadline).
 */

const LEASE_SECONDS = 20;
const FOLLOWED_PER_SWEEP = 100;
/** A machine with no cloud id this long after its reservation was never started. */
const NEVER_STARTED_MINUTES = 5;
/** A machine still up this long after its job ended is stopped rather than left to exit. */
const LINGER_MINUTES = 2;

interface LiveLaunch {
  id: string;
  pool_id: string;
  job_id: string;
  state: 'starting' | 'running';
  external_ref: string | null;
  registered_at: Date | null;
  token_expired: boolean;
  never_started: boolean;
  job_state: string;
  job_ended_long_ago: boolean;
  reserved: boolean;
  config: unknown;
  account_external_id: string | null;
  account_config: Record<string, unknown> | null;
  connection_id: string | null;
  provider: string | null;
  connection_name: string | null;
  layout: string | null;
  boundary_ref: string | null;
  connection_config: Record<string, unknown> | null;
}

const LIVE_JOB = ['ready', 'claimed', 'running'];
const UP = ['queued', 'working'];

async function lease(deps: MachinesDeps): Promise<LiveLaunch[]> {
  return deps.sql<LiveLaunch[]>`
    with leased as (
      update pipeline_runner_launches set checked_at = now()
      where id in (
        select id from pipeline_runner_launches
        where state in ('starting', 'running')
          and (checked_at is null or checked_at < now() - make_interval(secs => ${LEASE_SECONDS}))
        order by checked_at nulls first, created_at
        limit ${FOLLOWED_PER_SWEEP}
        for update skip locked)
      returning *)
    select l.id, l.pool_id, l.job_id, l.state, l.external_ref, l.registered_at,
      l.token_expires_at < now() as token_expired,
      l.external_ref is null
        and l.created_at < now() - make_interval(mins => ${NEVER_STARTED_MINUTES}) as never_started,
      j.state as job_state,
      coalesce(j.finished_at < now() - make_interval(mins => ${LINGER_MINUTES}), false)
        as job_ended_long_ago,
      j.launch_id is not distinct from l.id as reserved,
      p.config, a.external_id as account_external_id, a.config as account_config,
      c.id as connection_id, c.provider, c.name as connection_name, c.layout, c.boundary_ref,
      c.config as connection_config
    from leased l
    join pipeline_jobs j on j.id = l.job_id
    join pipeline_runner_pools p on p.id = l.pool_id
    left join cloud_accounts a on a.id = p.cloud_account_id
    left join cloud_connections c on c.id = a.connection_id`;
}

function refOf(launch: LiveLaunch): MachineRef | null {
  const region = regionOf(poolConfigOf(launch.config));
  if (!launch.external_ref || !region || !launch.account_external_id) return null;
  return {
    account: { externalId: launch.account_external_id, config: launch.account_config ?? {} },
    region,
    ref: launch.external_ref,
  };
}

async function settle(
  deps: MachinesDeps,
  launch: LiveLaunch,
  runners: RunnersPart | undefined,
  outcomes: RunOutcome[],
): Promise<void> {
  const connection = connectionOf(launch);
  const ref = refOf(launch);
  if (!launch.external_ref) {
    if (launch.never_started) {
      await endLaunch(deps.sql, launch.id, {
        state: 'failed',
        error: 'The machine was never started',
        release: true,
      });
    }
    return;
  }
  if (!connection || !ref || !runners?.status) {
    await endLaunch(deps.sql, launch.id, {
      state: 'failed',
      error: 'Pipelines can no longer reach the project this machine runs in',
      release: true,
    });
    return;
  }
  const ours = launch.reserved && LIVE_JOB.includes(launch.job_state);
  if (!ours) {
    const status = await runners.status(connection, ref);
    const stop = launch.job_state === 'cancelled' || !launch.reserved || launch.job_ended_long_ago;
    if (UP.includes(status.state) && !stop) return;
    if (UP.includes(status.state)) await runners.cancel?.(connection, ref);
    await endLaunch(deps.sql, launch.id, {
      state: launch.job_state === 'cancelled' ? 'cancelled' : 'finished',
    });
    return;
  }
  if (launch.state === 'starting' && launch.token_expired && launch.job_state === 'ready') {
    await runners.cancel?.(connection, ref);
    await endLaunch(deps.sql, launch.id, {
      state: 'failed',
      error: 'The machine did not start in time, so the job waits for another',
      release: true,
    });
    return;
  }
  const status = await runners.status(connection, ref);
  if (UP.includes(status.state)) return;
  const why = status.detail ?? `The machine ended as ${status.state}`;
  if (status.state === 'failed') {
    // Best effort: the machine's own deadline ends it if the cloud refuses the stop.
    await runners.cancel?.(connection, ref).catch(() => undefined);
  }
  await endLaunch(deps.sql, launch.id, { state: 'failed', error: why });
  const outcome = await failJob(
    deps.sql,
    launch.job_id,
    `The build machine stopped before the job reported back: ${why}. Open the machine's log for the reason`,
  );
  if (outcome) outcomes.push(outcome);
}

/** Settles every live machine due a look; a cloud error on one leaves it for the next sweep. */
export async function followMachines(
  deps: MachinesDeps,
): Promise<{ followed: number; outcomes: RunOutcome[]; errors: string[] }> {
  const launches = await lease(deps);
  const registry = await deps.providers();
  const outcomes: RunOutcome[] = [];
  const errors: string[] = [];
  for (const launch of launches) {
    const runners = launch.provider
      ? registry.list().find((provider) => provider.id === launch.provider)?.runners
      : undefined;
    try {
      await settle(deps, launch, runners, outcomes);
    } catch (error) {
      errors.push(`${launch.external_ref ?? launch.id}: ${(error as Error).message}`);
    }
  }
  return { followed: launches.length, outcomes, errors };
}
