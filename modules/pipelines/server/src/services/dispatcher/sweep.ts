import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { HEARTBEAT_SECONDS } from '../../../../shared/runner.ts';
import { topicOf } from '../../../../shared/streams.ts';
import { advanceRun, wakeDispatch, type RunOutcome } from '../orchestrator/advance.ts';
import { publishStreamEvent } from '../streams/publish.ts';

/*
 * Lost runners and timeouts (architecture §5.2). A runner that misses three heartbeats has
 * lost its job: the job goes back to ready with attempt + 1, at most twice, so a flaky node
 * costs a retry and a dead one fails the job with a reason. A job past its timeout fails;
 * its runner hears "cancel" at its next heartbeat. Runs on every replica, every few seconds,
 * with SKIP LOCKED so replicas never fight over the same rows. Only jobs handed out through
 * the runner protocol (they hold a job token) are watched: anything else was never a
 * runner's to lose.
 */

export const MISSED_BEATS = 3;

export interface SweepResult {
  requeued: number;
  failed: number;
  timedOut: number;
  outcomes: RunOutcome[];
}

interface LostJob {
  id: string;
  run_id: string;
  pool_id: string | null;
  attempt: number;
  max_attempts: number;
  runner_id: string | null;
}

async function requeue(tx: SqlExecutor, job: LostJob) {
  await tx`
    update pipeline_jobs set
      state = 'ready', attempt = attempt + 1, runner_id = null, token_hash = null,
      token_expires_at = null, claimed_at = null, heartbeat_at = null, started_at = null,
      ready_at = now(), updated_at = now(),
      failure_summary = ${`The runner stopped answering, so attempt ${job.attempt + 1} of ${job.max_attempts} started`}
    where id = ${job.id}`;
  await tx`
    update pipeline_steps set state = 'pending', exit_code = null, first_line = null,
      line_count = null, started_at = null, finished_at = null, updated_at = now()
    where job_id = ${job.id}`;
  await tx`delete from pipeline_log_chunks where job_id = ${job.id}`;
}

export async function sweepJobs(sql: SqlClient, now = new Date()): Promise<SweepResult> {
  const lostBefore = new Date(now.getTime() - HEARTBEAT_SECONDS * MISSED_BEATS * 1000);
  return sql.begin(async (tx) => {
    const lost = await tx<LostJob[]>`
      select id, run_id, pool_id, attempt, max_attempts, runner_id from pipeline_jobs
      where state in ('claimed', 'running') and token_hash is not null
        and heartbeat_at < ${lostBefore.toISOString()}::timestamptz
      order by heartbeat_at limit 200
      for update skip locked`;
    const runs = new Set<string>();
    let requeued = 0;
    let failed = 0;
    for (const job of lost) {
      runs.add(job.run_id);
      if (job.attempt < job.max_attempts) {
        await requeue(tx, job);
        requeued += 1;
      } else {
        await tx`
          update pipeline_jobs set state = 'failed', finished_at = now(), updated_at = now(),
            failure_summary = ${`The runner stopped answering on all ${job.max_attempts} attempts`}
          where id = ${job.id}`;
        failed += 1;
      }
      await publishStreamEvent(tx, {
        topic: topicOf.run(job.run_id),
        kind: 'job.updated',
        data: {
          id: job.id,
          runId: job.run_id,
          state: job.attempt < job.max_attempts ? 'ready' : 'failed',
        },
      });
    }
    const runnerIds = lost.map((job) => job.runner_id).filter((id): id is string => Boolean(id));
    if (runnerIds.length > 0) {
      await tx`
        update pipeline_runners set state = 'gone', current_job_id = null, updated_at = now()
        where id = any(${runnerIds}::uuid[])
          and (last_heartbeat_at is null or last_heartbeat_at < ${lostBefore.toISOString()}::timestamptz)`;
    }
    await wakeDispatch(
      tx,
      lost.filter((job) => job.attempt < job.max_attempts).map((job) => job.pool_id),
    );
    const timedOut = await tx<{ id: string; run_id: string }[]>`
      update pipeline_jobs set state = 'failed', finished_at = now(), updated_at = now(),
        failure_summary = 'Timed out after ' || timeout_minutes || ' minutes'
      where id in (
        select id from pipeline_jobs
        where state = 'running' and token_hash is not null
          and started_at + make_interval(mins => timeout_minutes) < ${now.toISOString()}::timestamptz
        limit 200 for update skip locked)
      returning id, run_id`;
    for (const job of timedOut) runs.add(job.run_id);
    const outcomes: RunOutcome[] = [];
    for (const runId of runs) outcomes.push(await advanceRun(tx, runId));
    return { requeued, failed, timedOut: timedOut.length, outcomes };
  });
}
