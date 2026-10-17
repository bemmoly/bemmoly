import { insertMany, type Row } from './bulk.ts';
import { commitTitle } from './history.ts';
import { makeDeployment, makeRelease, targetKey, type LiveState } from './make.ts';
import { MINUTE, uuidv7 } from './rng.ts';
import { colleague, env, nextVersion, type AppInfo, type World } from './world.ts';

/*
 * The organisation right now: a few releases moving in every domain (deploying in Dev,
 * canaries in asia-south1, one waiting for approval in eu-west1, an occasional failure in
 * Staging), about 214 jobs on runners and 38 waiting for one, and pipeline_current written
 * from the history with those movements laid over it.
 */

export async function seedMoving(world: World, live: LiveState) {
  const { rng, now } = world;
  const at = now.getTime();
  const featured = new Set([
    'checkout-api',
    'pricing-svc',
    'refunds-api',
    'ledger-api',
    'payouts-worker',
    'storefront-web',
  ]);
  for (const [index, domain] of world.domains.entries()) {
    const apps = world.apps.filter(
      (a) => a.domainId === domain.id && a.weight > 0 && !featured.has(a.key),
    );
    const pool = rng.shuffle([...apps]);
    const plan: [string, 'deploying' | 'canary' | 'waiting' | 'failed', number][] = [];
    for (let i = 0; i < Math.max(1, Math.round(apps.length / 70)); i += 1)
      plan.push(['dev', 'deploying', 0]);
    if (index % 2 === 0) plan.push(['staging', 'deploying', 0]);
    if (index % 3 === 0) plan.push(['staging', 'failed', 0]);
    if (index % 2 === 0) plan.push(['prod-asia-south1', 'canary', 25]);
    if (index % 3 === 1) plan.push(['prod-eu-west1', 'waiting', 0]);
    for (const [envKey, state, traffic] of plan) {
      const app = pool.pop();
      if (!app) break;
      const target = env(world, envKey);
      const startedAt = at - rng.int(2, 25) * MINUTE;
      const version = nextVersion(app, rng);
      const releaseId = await makeRelease(world, {
        app,
        version,
        runId: null,
        authorId: colleague(world, app),
        createdAt: startedAt - 40 * MINUTE,
      });
      const steps: (readonly [string, number])[] =
        state === 'canary'
          ? [
              ['pending', 0],
              ['deploying', 0],
              ['canary', 5],
              ['canary', 25],
            ]
          : state === 'waiting'
            ? [['pending', 0]]
            : [
                ['pending', 0],
                ['deploying', 0],
                ...(state === 'failed' ? [['failed', 0] as const] : []),
              ];
      await makeDeployment(world, {
        app,
        target,
        releaseId,
        state: state === 'waiting' ? 'pending' : state,
        traffic,
        startedAt,
        authorId: null,
        steps,
      });
      live.moving.set(targetKey(app, target), { state, releaseId, version, traffic });
    }
  }
}

function liveJob(
  world: World,
  runId: string,
  app: AppInfo,
  key: string,
  name: string,
  kind: string,
  state: string,
  started: number,
): Row {
  const running = state === 'running' || state === 'claimed';
  return {
    id: uuidv7(world.rng, started),
    run_id: runId,
    application_id: app.id,
    key,
    name,
    kind,
    needs: key.startsWith('build') ? [] : [`build-${app.key}`],
    state,
    pool_id: world.pools[world.rng.chance(0.85) ? 0 : 2]?.id ?? null,
    team_id: app.ownerTeam?.id ?? null,
    priority_class: 'main',
    ready_at: state === 'pending' ? null : new Date(started),
    claimed_at: running ? new Date(started + 3000) : null,
    heartbeat_at: running ? new Date(world.now.getTime() - world.rng.int(1, 9) * 1000) : null,
    started_at: running || state === 'passed' ? new Date(started + 6000) : null,
    finished_at: state === 'passed' ? new Date(started + 90_000) : null,
    created_at: new Date(started),
  };
}

/** Runs in progress until the counter reads about 214 running and 38 queued. */
export async function seedLiveJobs(world: World) {
  const { rng, now, scale, sql } = world;
  const wantRunning = Math.round(214 * scale);
  const wantReady = Math.round(38 * scale);
  const runs: Row[] = [];
  const links: Row[] = [];
  const jobs: Row[] = [];
  let running = 0;
  let ready = 0;
  const candidates = world.apps.filter((a) => a.weight > 0 && a.ciMode !== 'external');
  while (running < wantRunning || ready < wantReady) {
    const app = rng.pick(candidates);
    const created = now.getTime() - rng.int(1, 12) * MINUTE;
    const id = uuidv7(rng, created);
    const main = rng.chance(0.4);
    runs.push({
      id,
      application_id: app.id,
      repository_id: app.repoId,
      trigger: main ? 'push' : 'pull_request',
      ref: main ? 'main' : `pull/${rng.int(900, 9900)}`,
      commit_sha: rng.hex(40),
      title: commitTitle(rng),
      author_user_id: colleague(world, app),
      team_id: app.ownerTeam?.id ?? null,
      state: 'running',
      priority_class: main ? 'main' : 'pull_request',
      started_at: new Date(created + 15_000),
      created_at: new Date(created),
    });
    links.push({ run_id: id, application_id: app.id });
    const queued = running >= wantRunning;
    jobs.push(
      liveJob(world, id, app, `build-${app.key}`, `Build ${app.key}`, 'build', 'passed', created),
    );
    const shards = rng.int(1, 3);
    for (let i = 1; i <= shards; i += 1) {
      const state = queued ? 'ready' : rng.chance(0.1) ? 'claimed' : 'running';
      if (state === 'ready') ready += 1;
      else running += 1;
      jobs.push(
        liveJob(
          world,
          id,
          app,
          `unit-${i}`,
          `Unit ${i} of ${shards}`,
          'test',
          state,
          created + 100_000,
        ),
      );
    }
    jobs.push(
      liveJob(world, id, app, 'scan', 'Security scan', 'scan', 'pending', created + 100_000),
    );
  }
  await insertMany(sql, 'pipeline_runs', runs);
  await insertMany(sql, 'pipeline_run_applications', links);
  await insertMany(sql, 'pipeline_jobs', jobs);
  const busy = jobs.filter((j) => j['state'] === 'running' || j['state'] === 'claimed');
  const runnerIds = busy.map(() => uuidv7(rng, now.getTime() - 20 * MINUTE));
  await insertMany(
    sql,
    'pipeline_runners',
    busy.map((job, i) => ({
      id: runnerIds[i],
      pool_id: job['pool_id'],
      name: `runner-${rng.hex(8)}`,
      version: '0.1.0',
      state: 'busy',
      labels: ['linux-x64'],
      current_job_id: job['id'],
      last_heartbeat_at: job['heartbeat_at'],
    })),
  );
  await sql`
    update pipeline_jobs j set runner_id = r.id from pipeline_runners r
    where r.current_job_id = j.id and j.state in ('claimed', 'running')`;
  world.log(`${running} jobs running, ${ready} queued`);
}

/** pipeline_current for every application in every environment, movements laid over. */
export async function writeCurrent(world: World, live: LiveState) {
  const rows: Row[] = [];
  for (const app of world.apps) {
    for (const target of world.envs) {
      const key = targetKey(app, target);
      const current = live.current.get(key);
      const moving = live.moving.get(key);
      rows.push({
        application_id: app.id,
        environment_id: target.id,
        domain_id: app.domainId,
        group_id: app.groupId,
        release_id: current?.releaseId ?? null,
        version: current?.version ?? null,
        deployment_id: current?.deploymentId ?? null,
        state: moving?.state ?? 'idle',
        moving_release_id: moving && moving.state !== 'rolled_back' ? moving.releaseId : null,
        moving_version: moving && moving.state !== 'rolled_back' ? moving.version : null,
        traffic_percent: moving ? moving.traffic : current ? 100 : 0,
        deployed_at: current ? new Date(current.deployedAt) : null,
      });
    }
  }
  await insertMany(world.sql, 'pipeline_current', rows);
}
