import type { SqlExecutor } from '@bemmoly/core';
import { topicOf } from '../../../../shared/streams.ts';
import { publishStreamEvent } from '../streams/publish.ts';

/*
 * Moves a run forward after any job changes state, in the caller's transaction: jobs whose
 * needs all passed become ready (and wake the dispatcher for their pool), jobs behind a
 * failure are skipped, and the run's own state follows its jobs. Set-based, so a run of
 * 200 shards costs the same few statements as a run of three.
 */

/** Dispatcher wake-ups: the payload is the pool id whose queue gained a ready job. */
export const DISPATCH_CHANNEL = 'pipelines_dispatch';

export interface RunOutcome {
  runId: string;
  state: string;
  /** True when this call moved the run into a finished state. */
  finished: boolean;
}

const FINISHED = ['passed', 'failed', 'cancelled', 'skipped'];

async function skipBehindFailures(tx: SqlExecutor, runId: string): Promise<number> {
  let total = 0;
  // A skip can make the next job's needs fail too; a chain is at most as long as the run.
  for (let round = 0; round < 64; round += 1) {
    const skipped = await tx`
      update pipeline_jobs j
      set state = 'skipped', finished_at = now(), updated_at = now(),
        failure_summary = 'Skipped because a job it needs did not pass'
      where j.run_id = ${runId} and j.state = 'pending'
        and exists (
          select 1 from unnest(j.needs) as n(key)
          join pipeline_jobs d on d.run_id = j.run_id and d.key = n.key
          where d.state in ('failed', 'cancelled', 'skipped'))
      returning j.id`;
    total += skipped.length;
    if (skipped.length === 0) break;
  }
  return total;
}

async function readyUnblocked(tx: SqlExecutor, runId: string) {
  return tx<{ id: string; pool_id: string | null }[]>`
    update pipeline_jobs j
    set state = 'ready', ready_at = now(), updated_at = now()
    where j.run_id = ${runId} and j.state = 'pending'
      and not exists (
        select 1 from unnest(j.needs) as n(key)
        left join pipeline_jobs d on d.run_id = j.run_id and d.key = n.key
        where d.state is distinct from 'passed')
    returning j.id, j.pool_id`;
}

export async function wakeDispatch(tx: SqlExecutor, poolIds: Iterable<string | null>) {
  for (const pool of new Set([...poolIds].filter((id): id is string => Boolean(id)))) {
    await tx`select pg_notify(${DISPATCH_CHANNEL}, ${pool})`;
  }
}

/** The run's state from its jobs' states, and moves it there. */
async function settleRun(tx: SqlExecutor, runId: string): Promise<RunOutcome> {
  const [counts] = await tx<
    {
      live: number;
      started: number;
      failed: number;
      cancelled: number;
      total: number;
      unstartable: boolean;
    }[]
  >`
    select
      count(*) filter (where state in ('pending', 'ready', 'claimed', 'running'))::int as live,
      count(*) filter (where started_at is not null or state in ('claimed', 'running'))::int
        as started,
      count(*) filter (where state = 'failed')::int as failed,
      count(*) filter (where state = 'cancelled')::int as cancelled,
      count(*)::int as total,
      (select failure_reason is not null from pipeline_runs where id = ${runId}) as unstartable
    from pipeline_jobs where run_id = ${runId}`;
  const c = counts ?? {
    live: 0,
    started: 0,
    failed: 0,
    cancelled: 0,
    total: 0,
    unstartable: false,
  };
  const state =
    c.live > 0
      ? c.started > 0
        ? 'running'
        : 'queued'
      : c.failed > 0
        ? 'failed'
        : c.cancelled > 0
          ? 'cancelled'
          : c.total === 0
            ? // A run that failed before any job (runs/failed.ts) stays failed.
              c.unstartable
              ? 'failed'
              : 'skipped'
            : 'passed';
  const finishing = FINISHED.includes(state);
  const [row] = await tx<{ previous: string; number: number }[]>`
    update pipeline_runs r set
      state = ${state},
      started_at = case when ${c.started > 0} then coalesce(r.started_at, now()) else r.started_at end,
      finished_at = case when ${finishing} then coalesce(r.finished_at, now()) else null end,
      updated_at = now()
    from (select state as previous from pipeline_runs where id = ${runId} for update) p
    where r.id = ${runId}
    returning p.previous, r.number`;
  const changed = row !== undefined && row.previous !== state;
  if (changed) {
    await publishStreamEvent(tx, {
      topic: topicOf.run(runId),
      kind: 'run.updated',
      data: { id: runId, state, number: Number(row.number) },
    });
    await publishStreamEvent(tx, {
      topic: topicOf.live(),
      kind: 'run.updated',
      data: { id: runId, state },
    });
  }
  return {
    runId,
    state,
    finished: changed && finishing && !FINISHED.includes(row?.previous ?? ''),
  };
}

export async function advanceRun(tx: SqlExecutor, runId: string): Promise<RunOutcome> {
  await skipBehindFailures(tx, runId);
  const ready = await readyUnblocked(tx, runId);
  await wakeDispatch(
    tx,
    ready.map((job) => job.pool_id),
  );
  for (const job of ready) {
    await publishStreamEvent(tx, {
      topic: topicOf.run(runId),
      kind: 'job.updated',
      data: { id: job.id, runId, state: 'ready' },
    });
  }
  return settleRun(tx, runId);
}
