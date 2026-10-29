import type { SqlClient } from '@bemmoly/core';
import { isBemmolyError } from '@bemmoly/shared';
import { topicOf } from '../../../../shared/streams.ts';
import { pickNextJob } from '../dispatcher/claim.ts';
import type { RunOutcome } from '../orchestrator/advance.ts';
import type { RunnersPart } from '../providers/contract.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { hashToken, newToken } from '../../utils/tokens.ts';
import {
  connectionOf,
  endLaunch,
  failJob,
  poolConfigOf,
  recordStarted,
  setPoolError,
  type MachinePoolRow,
} from './store.ts';
import type { MachinesDeps } from './types.ts';

/*
 * Starting one machine per queued job. Pools take turns, oldest waiting job first, one start
 * each per round, so a busy pool cannot use the whole sweep's budget while another waits.
 * Each start reserves its job under the pool's row lock (the lock claims take), so two
 * servers sweeping at once never start more than a pool's most runners, and never two
 * machines for one job. The cloud call happens after the reservation commits.
 */

/** Builds started per sweep, across every pool; the next sweep carries on. */
export const STARTS_PER_SWEEP = 20;
/** How long a launch token waits for its machine to register. */
const TOKEN_MINUTES = 30;
/** Time for a machine to start, on top of the job's own timeout. */
const START_MINUTES = 15;

const FORK_REFUSED =
  "Pools whose machines Pipelines starts do not run pull requests from forks, because the fork's code could reach the machine's cloud identity. Send fork pull requests to a pool of machines you start";

interface Reserved {
  launchId: string;
  jobId: string;
  runId: string;
  timeoutMinutes: number;
  token: string;
}

type Reservation = Reserved | { refused: string; jobId: string } | null;

async function reserve(sql: SqlClient, pool: MachinePoolRow): Promise<Reservation> {
  return sql.begin(async (tx): Promise<Reservation> => {
    await tx`select id from pipeline_runner_pools where id = ${pool.id} for update`;
    const [live] = await tx<{ count: number }[]>`
      select count(*)::int as count from pipeline_runner_launches
      where pool_id = ${pool.id} and state in ('starting', 'running')`;
    if ((live?.count ?? 0) >= pool.max_runners) return null;
    const jobId = await pickNextJob(tx, pool.id);
    if (!jobId) return null;
    const [job] = await tx<{ run_id: string; timeout_minutes: number; from_fork: boolean }[]>`
      select j.run_id, j.timeout_minutes, coalesce(r.from_fork, false) as from_fork
      from pipeline_jobs j join pipeline_runs r on r.id = j.run_id where j.id = ${jobId}`;
    if (!job) return null;
    if (job.from_fork) return { refused: FORK_REFUSED, jobId };
    const token = newToken('launch');
    const [launch] = await tx<{ id: string }[]>`
      insert into pipeline_runner_launches (pool_id, job_id, token_hash, token_expires_at)
      values (${pool.id}, ${jobId}, ${hashToken(token)},
        now() + make_interval(mins => ${TOKEN_MINUTES}))
      returning id`;
    if (!launch) return null;
    await tx`update pipeline_jobs set launch_id = ${launch.id}, updated_at = now() where id = ${jobId}`;
    await publishStreamEvent(tx, {
      topic: topicOf.run(job.run_id),
      kind: 'job.updated',
      data: { id: jobId, runId: job.run_id, state: 'ready' },
    });
    await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
    return {
      launchId: launch.id,
      jobId,
      runId: job.run_id,
      timeoutMinutes: job.timeout_minutes,
      token,
    };
  });
}

/** Why a pool cannot start machines at all, or null when it can. */
function blocker(deps: MachinesDeps, pool: MachinePoolRow, runners: RunnersPart | undefined) {
  if (!deps.publicUrl) {
    return "Set Bemmoly's public address (BEMMOLY_PUBLIC_URL) so build machines can call back";
  }
  if (!connectionOf(pool) || !pool.account_external_id) {
    return 'This pool names no project Pipelines is connected to; choose one in Capacity';
  }
  if (!runners?.launch) return 'This cloud cannot start build machines yet';
  if (!poolConfigOf(pool.config).cloudBuild) {
    return 'This pool has no Cloud Build settings; set its region, image and service account';
  }
  return null;
}

async function startOne(
  deps: MachinesDeps,
  pool: MachinePoolRow,
  runners: RunnersPart,
  outcomes: RunOutcome[],
): Promise<boolean> {
  const sql = deps.sql;
  const reserved = await reserve(sql, pool);
  if (!reserved) return false;
  if ('refused' in reserved) {
    const outcome = await failJob(sql, reserved.jobId, reserved.refused);
    if (outcome) outcomes.push(outcome);
    return true;
  }
  const settings = poolConfigOf(pool.config).cloudBuild;
  const connection = connectionOf(pool);
  if (!settings || !connection || !runners.launch) return false;
  try {
    const started = await runners.launch(connection, {
      account: { externalId: pool.account_external_id ?? '', config: pool.account_config ?? {} },
      region: settings.region,
      image: settings.image,
      machineType: settings.machine === 'default' ? null : settings.machine,
      serviceAccount: settings.serviceAccount,
      controlPlaneUrl: deps.publicUrl ?? '',
      launchToken: reserved.token,
      timeoutMinutes: reserved.timeoutMinutes + START_MINUTES,
      labels: { pool: pool.key, job: reserved.jobId, run: reserved.runId },
    });
    await recordStarted(sql, reserved.launchId, started);
    await setPoolError(sql, pool.id, null);
    return true;
  } catch (error) {
    const message = (error as Error).message;
    await setPoolError(sql, pool.id, message);
    // A refusal a person must fix fails the job with its reason; anything else (a timeout, a
    // cloud outage) hands the job back so the next sweep tries again.
    if (isBemmolyError(error)) {
      await endLaunch(sql, reserved.launchId, { state: 'failed', error: message });
      const outcome = await failJob(sql, reserved.jobId, message);
      if (outcome) outcomes.push(outcome);
    } else {
      await endLaunch(sql, reserved.launchId, { state: 'failed', error: message, release: true });
    }
    return false;
  }
}

/** Starts machines for every one-job pool's waiting jobs, taking turns between pools. */
export async function startMachines(
  deps: MachinesDeps,
  pools: readonly MachinePoolRow[],
  budget = STARTS_PER_SWEEP,
): Promise<{ started: number; outcomes: RunOutcome[] }> {
  const outcomes: RunOutcome[] = [];
  const turns: Array<{ pool: MachinePoolRow; runners: RunnersPart }> = [];
  for (const pool of pools) {
    if (pool.oldest === null) continue;
    const runners = pool.provider
      ? (await deps.providers()).list().find((p) => p.id === pool.provider)?.runners
      : undefined;
    const why = blocker(deps, pool, runners);
    if (why) await setPoolError(deps.sql, pool.id, why);
    else if (runners) turns.push({ pool, runners });
  }
  let started = 0;
  while (turns.length > 0 && started < budget) {
    for (const turn of [...turns]) {
      if (started >= budget) break;
      if (await startOne(deps, turn.pool, turn.runners, outcomes)) started += 1;
      else turns.splice(turns.indexOf(turn), 1);
    }
  }
  return { started, outcomes };
}
