import { COMMIT_OBJECTS, COMMIT_VERBS } from '../demo/names.ts';
import { uuidv7, type Rng } from '../demo/rng.ts';
import type {
  Action,
  SimApp,
  SimCatalog,
  SimDeployment,
  SimJob,
  SimRun,
  SimState,
} from './model.ts';

/*
 * Runs, planned in memory: a run starts with the jobs the Run screen draws (build, test
 * shards, lint, the security scan and publish on main), each job waits a moment for a
 * runner and runs for a minute or two, and the run settles the way the orchestrator settles
 * it: a job whose needs all passed becomes ready, a job behind a failure is skipped.
 */

export const SECOND = 1000;

const between = (rng: Rng, low: number, high: number) => rng.int(low, high) * SECOND;

/** Someone in the owning team; the demo person now and then, so For you moves too. */
export function authorFor(catalog: SimCatalog, app: SimApp, rng: Rng): string | null {
  const demo = catalog.demoId;
  if (demo && app.members.includes(demo) && rng.chance(0.25)) return demo;
  const others = app.members.filter((id) => id !== demo);
  return others.length > 0 ? rng.pick(others) : null;
}

function job(
  rng: Rng,
  now: number,
  pool: string | null,
  fields: Pick<SimJob, 'key' | 'name' | 'kind' | 'needs'>,
): SimJob {
  return {
    id: uuidv7(rng, now),
    ...fields,
    state: 'pending',
    poolId: pool,
    fails: false,
    dueAt: 0,
  };
}

export function startRun(catalog: SimCatalog, app: SimApp, rng: Rng, now: number): Action {
  const main = rng.chance(0.4);
  const pool = catalog.poolIds[rng.chance(0.85) ? 0 : 1] ?? catalog.poolIds[0] ?? null;
  const build = `build-${app.key}`;
  const shards = rng.int(1, 3);
  const jobs: SimJob[] = [
    job(rng, now, pool, { key: build, name: `Build ${app.key}`, kind: 'build', needs: [] }),
  ];
  for (let i = 1; i <= shards; i += 1) {
    const name = `Unit ${i} of ${shards}`;
    jobs.push(job(rng, now, pool, { key: `unit-${i}`, name, kind: 'test', needs: [build] }));
  }
  jobs.push(
    job(rng, now, pool, { key: 'lint', name: 'Lint and types', kind: 'test', needs: [build] }),
  );
  jobs.push(
    job(rng, now, pool, { key: 'scan', name: 'Security scan', kind: 'scan', needs: [build] }),
  );
  if (main) {
    const name = `Publish ${app.key}`;
    jobs.push(
      job(rng, now, pool, { key: `publish-${app.key}`, name, kind: 'publish', needs: ['scan'] }),
    );
  }
  // About one run in twelve fails, nearly always in a test shard or lint.
  if (rng.chance(0.08)) {
    const tests = jobs.filter((j) => j.kind === 'test');
    rng.pick(rng.chance(0.15) ? jobs.slice(0, 1) : tests).fails = true;
  }
  const run: SimRun = { id: uuidv7(rng, now), appId: app.id, main, authorId: null, jobs };
  run.authorId = authorFor(catalog, app, rng);
  settle(run, rng, now);
  return {
    kind: 'run.start',
    run,
    title: `${rng.pick(COMMIT_VERBS)} ${rng.pick(COMMIT_OBJECTS)}`,
    sha: rng.hex(40),
    pullRequest: main ? null : rng.int(900, 9900),
  };
}

/** The orchestrator's rules, in memory: skip behind failures, ready what is unblocked. */
export function settle(run: SimRun, rng: Rng, now: number): void {
  const byKey = new Map(run.jobs.map((j) => [j.key, j]));
  for (let changed = true; changed;) {
    changed = false;
    for (const j of run.jobs) {
      if (j.state !== 'pending') continue;
      const needs = j.needs.map((key) => byKey.get(key)?.state);
      if (needs.some((s) => s === 'failed' || s === 'skipped')) {
        j.state = 'skipped';
        changed = true;
      }
    }
  }
  for (const j of run.jobs) {
    if (j.state === 'pending' && j.needs.every((key) => byKey.get(key)?.state === 'passed')) {
      j.state = 'ready';
      j.dueAt = now + between(rng, 2, 12);
    }
  }
}

const named = (run: SimRun, target: SimJob) => ({ appId: run.appId, jobName: target.name });

const live = (run: SimRun) =>
  run.jobs.some((j) => j.state === 'pending' || j.state === 'ready' || j.state === 'running');

/** Moves one due job on: a ready job starts, a running one passes or fails. */
export function advanceJob(
  state: SimState,
  catalog: SimCatalog,
  run: SimRun,
  target: SimJob,
  rng: Rng,
  now: number,
  dev: (app: SimApp, releaseId: string, version: string) => SimDeployment | null,
): Action {
  if (target.state === 'ready') {
    target.state = 'running';
    target.dueAt = now + between(rng, target.kind === 'test' ? 30 : 20, 90);
    return { kind: 'job.start', runId: run.id, jobId: target.id, ...named(run, target) };
  }
  target.state = target.fails ? 'failed' : 'passed';
  settle(run, rng, now);
  let release: Extract<Action, { kind: 'job.finish' }>['release'] = null;
  let deployment: SimDeployment | null = null;
  if (!live(run)) {
    state.runs = state.runs.filter((r) => r !== run);
    const app = catalog.apps.find((a) => a.id === run.appId);
    if (app && run.main && run.jobs.every((j) => j.state === 'passed')) {
      release = {
        id: uuidv7(rng, now),
        appId: app.id,
        version: bump(app, rng),
        authorId: run.authorId,
      };
      deployment = dev(app, release.id, release.version);
    }
  }
  return {
    kind: 'job.finish',
    runId: run.id,
    jobId: target.id,
    ...named(run, target),
    passed: target.state === 'passed',
    release,
    deployment,
  };
}

export function bump(app: SimApp, rng: Rng): string {
  const v = app.version;
  if (rng.chance(0.15)) {
    v.minor += 1;
    v.patch = 0;
  } else {
    v.patch += 1;
  }
  return `v${v.major}.${v.minor}.${v.patch}`;
}
