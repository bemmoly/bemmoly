import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { topicOf } from '../../../../shared/streams.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { NO_TEAM, pickTeam, readDispatchState, type FairCandidate } from './fair.ts';

/*
 * One claim (architecture §5.1): in one transaction, lock the pool's row (claims for one
 * pool take turns, which keeps the fair-share state exact and costs a few milliseconds),
 * find which teams have eligible ready work in the most urgent class present, pick the team
 * by deficit round robin, and claim that team's oldest eligible job with SKIP LOCKED.
 *
 * Classes are strict: rollback > deploy > main > pull_request > scheduled. Roll backs and
 * deploys skip fair share entirely and go oldest first; the rest share by team. A job with a
 * concurrency key waits while its key already has `concurrency_limit` jobs claimed or running.
 */

/** Below this priority value a class skips fair share (rollback 0, deploy 1). */
const FAIR_SHARE_FROM = 2;

export interface ClaimInput {
  poolId: string;
  runnerId: string;
  tokenHash: string;
}

export interface ClaimedRow {
  id: string;
  run_id: string;
  key: string;
  timeout_minutes: number;
  token_expires_at: string;
}

const eligible = (tx: SqlExecutor) => tx`
  (j.concurrency_key is null or (
    select count(*) from pipeline_jobs r
    where r.concurrency_key = j.concurrency_key and r.state in ('claimed', 'running')
  ) < j.concurrency_limit)`;

async function weightsOf(tx: SqlExecutor, poolId: string, teams: string[]) {
  const ids = teams.filter((team) => team !== NO_TEAM);
  const rows =
    ids.length === 0
      ? []
      : await tx<{ team_id: string; weight: number }[]>`
          select team_id, weight from pipeline_team_shares
          where pool_id = ${poolId} and team_id = any(${ids}::uuid[])`;
  const weights = new Map(rows.map((row) => [row.team_id, row.weight]));
  return teams.map((team): FairCandidate => ({ team, weight: weights.get(team) ?? 1 }));
}

async function pickJob(tx: SqlExecutor, poolId: string): Promise<string | null> {
  const groups = await tx<{ team: string; best: number }[]>`
    select coalesce(j.team_id::text, ${NO_TEAM}) as team, min(j.priority)::int as best
    from pipeline_jobs j
    where j.state = 'ready' and j.pool_id = ${poolId} and ${eligible(tx)}
    group by 1`;
  if (groups.length === 0) return null;
  const best = Math.min(...groups.map((group) => group.best));
  if (best < FAIR_SHARE_FROM) {
    const [job] = await tx<{ id: string }[]>`
      select j.id from pipeline_jobs j
      where j.state = 'ready' and j.pool_id = ${poolId} and j.priority = ${best}
        and ${eligible(tx)}
      order by j.ready_at, j.id limit 1 for update of j skip locked`;
    return job?.id ?? null;
  }
  const [pool] = await tx<{ dispatch_state: unknown }[]>`
    select dispatch_state from pipeline_runner_pools where id = ${poolId}`;
  const teams = groups.filter((group) => group.best === best).map((group) => group.team);
  const pick = pickTeam(
    readDispatchState(pool?.dispatch_state),
    await weightsOf(tx, poolId, teams),
  );
  if (!pick) return null;
  const team = pick.team === NO_TEAM ? null : pick.team;
  const [job] = await tx<{ id: string }[]>`
    select j.id from pipeline_jobs j
    where j.state = 'ready' and j.pool_id = ${poolId} and j.priority = ${best}
      and j.team_id is not distinct from ${team}::uuid and ${eligible(tx)}
    order by j.ready_at, j.id limit 1 for update of j skip locked`;
  if (!job) return null;
  await tx`
    update pipeline_runner_pools set dispatch_state = ${JSON.stringify(pick.state)}::jsonb
    where id = ${poolId}`;
  return job.id;
}

/** Claims the next job for a runner of the pool, or null when nothing is eligible. */
export async function claimNextJob(sql: SqlClient, input: ClaimInput): Promise<ClaimedRow | null> {
  return sql.begin(async (tx) => {
    const [pool] = await tx`
      select id from pipeline_runner_pools where id = ${input.poolId} for update`;
    if (!pool) return null;
    const jobId = await pickJob(tx, input.poolId);
    if (!jobId) return null;
    const [claimed] = await tx<ClaimedRow[]>`
      update pipeline_jobs set
        state = 'claimed', runner_id = ${input.runnerId}, token_hash = ${input.tokenHash},
        claimed_at = now(), heartbeat_at = now(), updated_at = now(),
        token_expires_at = now() + make_interval(mins => timeout_minutes + 15)
      where id = ${jobId}
      returning id, run_id, key, timeout_minutes, token_expires_at::text`;
    if (!claimed) return null;
    await tx`
      update pipeline_runners set state = 'busy', current_job_id = ${jobId},
        last_heartbeat_at = now(), updated_at = now()
      where id = ${input.runnerId}`;
    await publishStreamEvent(tx, {
      topic: topicOf.run(claimed.run_id),
      kind: 'job.updated',
      data: { id: jobId, runId: claimed.run_id, state: 'claimed' },
    });
    await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
    return claimed;
  });
}
