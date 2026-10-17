import type { SqlExecutor } from '@bemmoly/core';
import type { Capacity, CapacityQuery } from '../../../../shared/capacity.ts';
import { capacityQuerySchema } from '../../../../shared/capacity.ts';
import { iso } from '../../utils/time.ts';
import { readPools } from './pools.ts';

/*
 * Platform › Capacity in one request: pools, today's numbers, concurrency per half hour over
 * the range, each team's share against what it runs, and the queue with why each job waits.
 */

const RANGE_HOURS = { now: 24, '7d': 24 * 7, '30d': 24 * 30 } as const;
/** The wait the p95 is held against; a setting later, a sensible default now. */
const WAIT_TARGET_SECONDS = 60;

export async function readCapacity(sql: SqlExecutor, input: CapacityQuery): Promise<Capacity> {
  const { range } = capacityQuerySchema.parse(input);
  const since = new Date(Date.now() - RANGE_HOURS[range] * 3_600_000).toISOString();
  const pools = await readPools(sql);
  const [stats] = await sql<
    {
      running: number;
      queued: number;
      oldest: number | null;
      p95: number | null;
      minutes: number;
    }[]
  >`
    select
      (select count(*)::int from pipeline_jobs where state in ('claimed', 'running')) as running,
      (select count(*)::int from pipeline_jobs where state = 'ready') as queued,
      (select extract(epoch from now() - min(ready_at))::int from pipeline_jobs
        where state = 'ready') as oldest,
      (select percentile_cont(0.95) within group (order by extract(epoch from claimed_at - ready_at))::int
        from pipeline_jobs where claimed_at > ${since}::timestamptz and ready_at is not null) as p95,
      (select coalesce(sum(extract(epoch from coalesce(finished_at, now()) - started_at)) / 60, 0)::int
        from pipeline_jobs where started_at >= date_trunc('day', now())) as minutes`;
  const concurrency = await sql<{ start: Date | string; jobs: number }[]>`
    select b.start, count(j.id)::int as jobs
    from generate_series(date_trunc('hour', ${since}::timestamptz), now(), interval '30 minutes')
      as b(start)
    left join pipeline_jobs j on j.started_at < b.start + interval '30 minutes'
      and coalesce(j.finished_at, now()) >= b.start and j.started_at >= ${since}::timestamptz - interval '1 day'
    group by b.start order by b.start`;
  const peak = concurrency.reduce<{ jobs: number; at: string } | null>(
    (best, point) =>
      !best || point.jobs > best.jobs ? { jobs: point.jobs, at: iso(point.start) } : best,
    null,
  );
  const slots = pools.reduce((sum, pool) => sum + pool.max, 0);
  const teams = await sql<
    { id: string; name: string; running: number; weight: number; p95: number | null }[]
  >`
    select t.id, t.name,
      (select count(*)::int from pipeline_jobs j where j.team_id = t.id
        and j.state in ('claimed', 'running')) as running,
      coalesce((select max(weight) from pipeline_team_shares s where s.team_id = t.id), 1)::int as weight,
      (select percentile_cont(0.95) within group (order by extract(epoch from claimed_at - ready_at))::int
        from pipeline_jobs j where j.team_id = t.id and j.claimed_at > ${since}::timestamptz) as p95
    from teams t
    where exists (select 1 from pipeline_team_shares s where s.team_id = t.id)
      or exists (select 1 from pipeline_jobs j where j.team_id = t.id and j.state in ('ready', 'claimed', 'running'))
    order by t.name`;
  const totalWeight = teams.reduce((sum, team) => sum + team.weight, 0) || 1;
  const shares = new Map(
    teams.map((team) => [team.id, Math.floor((slots * team.weight) / totalWeight)]),
  );
  const queue = await sql<
    {
      id: string;
      what: string;
      pool: string | null;
      at_limit: boolean;
      team: string | null;
      team_id: string | null;
      waiting: number;
    }[]
  >`
    select j.id, coalesce(a.key, j.name) || ' · ' || case when r.pull_request is not null
        then 'PR #' || r.pull_request else r.ref end as what,
      p.key as pool, (select count(*) from pipeline_jobs b where b.pool_id = p.id
        and b.state in ('claimed', 'running')) >= p.max_runners as at_limit,
      t.name as team, j.team_id, extract(epoch from now() - j.ready_at)::int as waiting
    from pipeline_jobs j
    join pipeline_runs r on r.id = j.run_id
    left join pipeline_applications a on a.id = j.application_id
    left join pipeline_runner_pools p on p.id = j.pool_id
    left join teams t on t.id = j.team_id
    where j.state = 'ready'
    order by j.priority, j.ready_at limit 50`;
  const runningBy = new Map(teams.map((team) => [team.id, team.running]));
  return {
    stats: {
      running: stats?.running ?? 0,
      slots,
      queued: stats?.queued ?? 0,
      oldestWaitSeconds: stats?.oldest ?? null,
      waitP95Seconds: stats?.p95 ?? null,
      waitTargetSeconds: WAIT_TARGET_SECONDS,
      buildMinutesToday: stats?.minutes ?? 0,
      cacheSavedRatio: null,
      cacheSavedMinutes: null,
    },
    pools,
    concurrency: concurrency.map((point) => ({ start: iso(point.start), jobs: point.jobs })),
    peak: peak && peak.jobs > 0 ? peak : null,
    teams: teams.map((team) => ({
      team: { id: team.id, name: team.name },
      running: team.running,
      share: shares.get(team.id) ?? 0,
      weight: team.weight,
      borrowing: team.running > (shares.get(team.id) ?? 0),
      waitP95Seconds: team.p95,
    })),
    queue: queue.map((item) => ({
      jobId: item.id,
      glyph: 'queued',
      what: item.what,
      why:
        item.pool === null
          ? 'No runner pool is set up yet'
          : item.at_limit
            ? `${item.pool} at its limit`
            : item.team_id && (runningBy.get(item.team_id) ?? 0) > (shares.get(item.team_id) ?? 0)
              ? `${item.team} is over its share`
              : `Waiting for a runner in ${item.pool}`,
      waitingSeconds: Math.max(0, item.waiting),
    })),
  };
}
