import type { SqlExecutor } from '@bemmoly/core';
import { UnauthenticatedError } from '@bemmoly/shared';
import { hashToken } from '../../utils/tokens.ts';

/*
 * Who is calling the runner protocol. Runner calls carry the runner token; job calls carry
 * the job token, which names one job and stops working when the job's timeout (plus a
 * grace period for late log chunks) runs out. Tokens are looked up by hash only.
 */

export interface RunnerIdentity {
  id: string;
  pool_id: string;
  state: string;
}

export interface JobIdentity {
  id: string;
  run_id: string;
  application_id: string | null;
  attempt: number;
  state: string;
  runner_id: string | null;
  shard_index: number | null;
  shard_total: number | null;
  test_summary: { failed?: number; quarantined?: number } | null;
}

export async function runnerFromToken(
  sql: SqlExecutor,
  token: string | undefined,
): Promise<RunnerIdentity> {
  if (!token) throw new UnauthenticatedError('Send the runner token in x-bemmoly-runner-token');
  const [runner] = await sql<RunnerIdentity[]>`
    select id, pool_id, state from pipeline_runners
    where token_hash = ${hashToken(token)} and state <> 'gone'`;
  if (!runner) throw new UnauthenticatedError('This runner is not registered; register again');
  return runner;
}

export async function jobFromToken(
  sql: SqlExecutor,
  jobId: string,
  token: string | undefined,
): Promise<JobIdentity> {
  if (!token) throw new UnauthenticatedError('Send the job token in x-bemmoly-job-token');
  const [job] = await sql<JobIdentity[]>`
    select id, run_id, application_id, attempt, state, runner_id, shard_index, shard_total,
      test_summary
    from pipeline_jobs
    where id = ${jobId} and token_hash = ${hashToken(token)} and token_expires_at > now()`;
  if (!job) throw new UnauthenticatedError('This job token is not valid for this job any more');
  return job;
}

export const LIVE_JOB = ['claimed', 'running'];
