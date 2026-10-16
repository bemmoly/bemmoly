import type { SqlExecutor } from '@bemmoly/core';
import { advanceRun } from '../../server/src/services/orchestrator/advance.ts';
import type { Rng } from '../demo/rng.ts';
import type { JobState, SimCatalog, SimEnv, SimJob, SimState } from './model.ts';
import { emptyState } from './model.ts';
import { SECOND, settle } from './plan-runs.ts';

/*
 * What the simulator starts from: the seeded catalog, read once, and the things already in
 * motion that nobody else is moving (the seed's live runs, its deployments in flight, and
 * the simulator's own promotions from an earlier session), so the screens move from the
 * first second instead of after the first new run passes.
 */

const CANARY = [5, 25, 100];

interface AppRow {
  id: string;
  key: string;
  domain_key: string;
  group_key: string;
  owner_team_id: string | null;
  repository_id: string | null;
  tier: number;
  lifecycle: string;
  ci_mode: string;
  stale: boolean;
  members: string[];
  version: string | null;
}

function parseVersion(text: string | null) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(text ?? '');
  return match
    ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
    : { major: 1, minor: 0, patch: 0 };
}

export async function loadCatalog(sql: SqlExecutor): Promise<SimCatalog> {
  const rows = await sql<AppRow[]>`
    select a.id, a.key, d.key as domain_key, g.key as group_key, a.owner_team_id,
      a.repository_id, a.tier, a.lifecycle, a.ci_mode,
      coalesce(a.last_deployed_at < now() - interval '30 days', false) as stale,
      coalesce((select array_agg(m.user_id::text order by m.user_id) from team_members m
        where m.team_id = a.owner_team_id), '{}') as members,
      (select r.version from pipeline_releases r where r.application_id = a.id
        order by r.created_at desc, r.id desc limit 1) as version
    from pipeline_applications a
    join pipeline_domains d on d.id = a.domain_id
    join pipeline_groups g on g.id = a.group_id
    where a.archived_at is null
    order by a.key`;
  const envs = await sql<SimEnv[]>`
    select id, key, class from pipeline_environments where archived_at is null
    order by position, id`;
  const pools = await sql<{ id: string }[]>`
    select id from pipeline_runner_pools order by created_at, id`;
  // The seed puts its demo person in Payments and Checkout web; their For you is the show.
  const [demo] = await sql<{ id: string }[]>`
    select u.id from users u
    where exists (select 1 from team_members m join teams t on t.id = m.team_id
        where m.user_id = u.id and t.name = 'Payments')
      and exists (select 1 from team_members m join teams t on t.id = m.team_id
        where m.user_id = u.id and t.name = 'Checkout web')
    order by u.created_at, u.id limit 1`;
  return {
    apps: rows.map((row) => ({
      id: row.id,
      key: row.key,
      domainKey: row.domain_key,
      groupKey: row.group_key,
      teamId: row.owner_team_id,
      repositoryId: row.repository_id,
      members: row.members,
      tier: Number(row.tier),
      // Busier tiers run more; outside CI, deprecated or long-unshipped applications rest.
      weight:
        row.ci_mode === 'external' || row.stale
          ? 0
          : (row.lifecycle === 'deprecated' ? 0.1 : 1) * (3 - Number(row.tier)),
      version: parseVersion(row.version),
    })),
    envs,
    poolIds: pools.map((p) => p.id),
    demoId: demo?.id ?? null,
  };
}

const later = (rng: Rng, now: number, low: number, high: number) =>
  now + rng.int(low, high) * SECOND;

export async function loadState(
  sql: SqlExecutor,
  catalog: SimCatalog,
  rng: Rng,
  now: number,
): Promise<SimState> {
  const state = emptyState();
  const apps = new Set(catalog.apps.map((a) => a.id));
  const jobs = await sql<
    (Omit<SimJob, 'state' | 'fails' | 'dueAt'> & {
      state: string;
      run_id: string;
      app_id: string;
      main: boolean;
      author_id: string | null;
    })[]
  >`
    select j.id, j.key, j.name, j.kind, j.needs, j.state, j.pool_id as "poolId", r.id as run_id,
      r.application_id as app_id, r.ref = 'main' as main, r.author_user_id as author_id
    from pipeline_runs r join pipeline_jobs j on j.run_id = r.id
    where r.state in ('queued', 'running')
      and not exists (select 1 from pipeline_jobs t where t.run_id = r.id and t.token_hash is not null)
    order by r.id, j.id`;
  for (const row of jobs) {
    if (!apps.has(row.app_id)) continue;
    let run = state.runs.find((r) => r.id === row.run_id);
    if (!run) {
      run = {
        id: row.run_id,
        appId: row.app_id,
        main: row.main,
        authorId: row.author_id,
        jobs: [],
      };
      state.runs.push(run);
    }
    const jobState = (row.state === 'claimed' ? 'running' : row.state) as JobState;
    run.jobs.push({
      id: row.id,
      key: row.key,
      name: row.name,
      kind: row.kind,
      needs: row.needs,
      poolId: row.poolId,
      state: jobState,
      fails: row.kind === 'test' && rng.chance(0.06),
      dueAt: jobState === 'running' ? later(rng, now, 5, 60) : later(rng, now, 2, 20),
    });
  }
  // The seed leaves some jobs waiting on needs that already passed; the orchestrator readies
  // them now, or those runs would wait for a job that never finishes.
  for (const run of state.runs) {
    const passed = new Set(run.jobs.filter((j) => j.state === 'passed').map((j) => j.key));
    const blocked = run.jobs.some(
      (j) => j.state === 'pending' && j.needs.every((k) => passed.has(k)),
    );
    if (!blocked) continue;
    await advanceRun(sql, run.id);
    settle(run, rng, now);
  }
  const deployments = await sql<
    {
      id: string;
      application_id: string;
      environment_id: string;
      release_id: string;
      version: string;
      promotion_id: string | null;
      state: 'pending' | 'deploying' | 'canary';
      traffic_percent: number;
    }[]
  >`
    select d.id, d.application_id, d.environment_id, d.release_id, r.version, d.promotion_id,
      d.state, d.traffic_percent
    from pipeline_deployments d join pipeline_releases r on r.id = d.release_id
    left join pipeline_promotions p on p.id = d.promotion_id
    where d.state in ('pending', 'deploying', 'canary') and d.next_action_at is null
      and (d.promotion_id is null or p.plan->>'simulator' = 'true')
    order by d.id`;
  const prod = new Set(catalog.envs.filter((e) => e.class === 'prod').map((e) => e.id));
  for (const d of deployments) {
    if (!apps.has(d.application_id)) continue;
    const steps = prod.has(d.environment_id) ? CANARY.filter((s) => s > d.traffic_percent) : [];
    const rollsBack = d.state === 'canary' && steps.length > 1 && rng.chance(0.1);
    state.deployments.push({
      id: d.id,
      appId: d.application_id,
      envId: d.environment_id,
      releaseId: d.release_id,
      version: d.version,
      promotionId: d.promotion_id,
      state: d.state,
      traffic: d.traffic_percent,
      steps,
      failAt: rollsBack ? (steps[0] ?? null) : null,
      dueAt: later(rng, now, 3, 40),
    });
  }
  const promotions = await sql<
    {
      id: string;
      application_id: string;
      release_id: string;
      version: string;
      state: 'awaiting_approval' | 'rolling_out';
      current_wave: number;
    }[]
  >`
    select p.id, p.application_id, p.release_id, r.version, p.state, p.current_wave
    from pipeline_promotions p join pipeline_releases r on r.id = p.release_id
    where p.plan->>'simulator' = 'true' and p.next_check_at is null
      and p.state in ('awaiting_approval', 'rolling_out')
    order by p.id`;
  for (const p of promotions) {
    const moving = state.deployments.some((d) => d.promotionId === p.id);
    state.promotions.push({
      id: p.id,
      appId: p.application_id,
      releaseId: p.release_id,
      version: p.version,
      state: p.state,
      wave: Number(p.current_wave),
      outcome: null,
      dueAt: moving ? Number.POSITIVE_INFINITY : later(rng, now, 20, 90),
    });
  }
  await loadLanded(sql, catalog, state, rng, now);
  return state;
}

/** Releases already ahead in Dev or Staging: the next environment is theirs to reach. */
async function loadLanded(
  sql: SqlExecutor,
  catalog: SimCatalog,
  state: SimState,
  rng: Rng,
  now: number,
) {
  for (const [index, count] of [
    [0, 6],
    [1, 4],
  ] as const) {
    const here = catalog.envs[index];
    const next = catalog.envs[index + 1];
    if (!here || !next) continue;
    const rows = await sql<{ application_id: string; release_id: string; version: string }[]>`
      select h.application_id, h.release_id, h.version
      from pipeline_current h
      join pipeline_current n on n.application_id = h.application_id
        and n.environment_id = ${next.id}
      join pipeline_applications a on a.id = h.application_id
      where h.environment_id = ${here.id} and h.state = 'idle' and n.state = 'idle'
        and h.release_id is not null and h.release_id is distinct from n.release_id
      order by a.key limit ${count}`;
    for (const row of rows) {
      state.landed.push({
        appId: row.application_id,
        releaseId: row.release_id,
        version: row.version,
        envIndex: index,
        dueAt: later(rng, now, 5, 90),
      });
    }
  }
}
