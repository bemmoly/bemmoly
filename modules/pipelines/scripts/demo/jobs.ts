import type { Row } from './bulk.ts';
import { MINUTE, uuidv7, type Rng } from './rng.ts';
import type { AppInfo } from './world.ts';

/*
 * The jobs one run is made of, laid out the way the Run screen draws them: affected
 * services (monorepos only), a build per application, test shards, lint, the locked security
 * scan, then publish on the default branch. A failed run fails one test shard or lint and
 * skips what came after; a cancelled one was superseded by a newer push.
 */

export interface RunShape {
  id: string;
  apps: AppInfo[];
  monorepo: boolean;
  main: boolean;
  state: 'passed' | 'failed' | 'cancelled' | 'running' | 'queued';
  priorityClass: string;
  teamId: string | null;
  createdAt: number;
  startedAt: number;
}

export interface JobPlan {
  rows: Row[];
  finishedAt: number;
  /** Ids and names of the jobs, for steps. */
  jobs: { id: string; name: string; state: string; startedAt: number; finishedAt: number }[];
}

interface Node {
  key: string;
  name: string;
  kind: string;
  needs: string[];
  stage: number;
  appId: string | null;
  shard?: [number, number];
  pool: number;
}

function nodes(run: RunShape, rng: Rng, fixedShards?: number): Node[] {
  const list: Node[] = [];
  if (run.monorepo)
    list.push({
      key: 'detect',
      name: 'Affected services',
      kind: 'detect',
      needs: [],
      stage: 0,
      appId: null,
      pool: 0,
    });
  const after = run.monorepo ? ['detect'] : [];
  for (const app of run.apps) {
    list.push({
      key: `build-${app.key}`,
      name: `Build ${app.key}`,
      kind: 'build',
      needs: after,
      stage: 1,
      appId: app.id,
      pool: rng.chance(0.1) ? 1 : rng.chance(0.1) ? 2 : 0,
    });
  }
  const builds = run.apps.map((app) => `build-${app.key}`);
  const shards = fixedShards ?? rng.int(1, 3);
  for (let i = 1; i <= shards; i += 1) {
    list.push({
      key: `unit-${i}`,
      name: `Unit ${i} of ${shards}`,
      kind: 'test',
      needs: builds,
      stage: 2,
      appId: run.apps[0]?.id ?? null,
      shard: [i, shards],
      pool: 0,
    });
  }
  list.push({
    key: 'lint',
    name: 'Lint and types',
    kind: 'test',
    needs: builds,
    stage: 2,
    appId: null,
    pool: 0,
  });
  list.push({
    key: 'scan',
    name: 'Security scan',
    kind: 'scan',
    needs: builds,
    stage: 3,
    appId: null,
    pool: 0,
  });
  if (run.main) {
    for (const app of run.apps) {
      list.push({
        key: `publish-${app.key}`,
        name: `Publish ${app.key}`,
        kind: 'publish',
        needs: ['scan'],
        stage: 4,
        appId: app.id,
        pool: 0,
      });
    }
  }
  return list;
}

const DURATION: Readonly<Record<string, readonly [number, number]>> = {
  detect: [15, 40],
  build: [60, 180],
  test: [90, 240],
  scan: [40, 120],
  publish: [20, 60],
};

/** Jobs for a finished run; `pools` are the runner pool ids in the platform's order. */
export function planJobs(
  run: RunShape,
  rng: Rng,
  pools: readonly string[],
  options: { shards?: number; failKey?: string } = {},
): JobPlan {
  const list = nodes(run, rng, options.shards);
  const tests = list.filter((n) => n.kind === 'test');
  const failing =
    run.state === 'failed'
      ? (tests.find((n) => n.key === options.failKey) ?? rng.pick(tests))
      : null;
  const cancelAt = run.state === 'cancelled' ? rng.int(1, 3) : 99;
  const stageEnd = new Map<number, number>();
  let finishedAt = run.startedAt;
  const rows: Row[] = [];
  const jobs: JobPlan['jobs'] = [];
  let broken = false;
  for (const stage of [0, 1, 2, 3, 4]) {
    const start =
      stage === 0
        ? run.startedAt
        : (stageEnd.get(stage - 1) ?? run.startedAt) + rng.int(2, 15) * 1000;
    let end = start;
    for (const node of list.filter((n) => n.stage === stage)) {
      const [low, high] = DURATION[node.kind] ?? [30, 60];
      const ran = !broken && stage < cancelAt;
      const state = !ran
        ? run.state === 'cancelled'
          ? 'cancelled'
          : 'skipped'
        : node === failing
          ? 'failed'
          : 'passed';
      const startedAt = start + rng.int(1, 20) * 1000;
      const done = ran ? startedAt + rng.int(low, high) * 1000 : startedAt;
      end = Math.max(end, done);
      const id = uuidv7(rng, run.createdAt + rows.length);
      jobs.push({ id, name: node.name, state, startedAt, finishedAt: done });
      rows.push({
        id,
        run_id: run.id,
        application_id: node.appId,
        key: node.key,
        name: node.name,
        kind: node.kind,
        needs: node.needs,
        state,
        pool_id: pools[node.pool] ?? null,
        team_id: run.teamId,
        priority_class: run.priorityClass,
        shard_index: node.shard?.[0] ?? null,
        shard_total: node.shard?.[1] ?? null,
        attempt: 1,
        failure_summary:
          state === 'failed'
            ? node.key === 'lint'
              ? 'Lint found 3 problems'
              : '2 tests failed'
            : null,
        ready_at: ran ? new Date(start) : null,
        claimed_at: ran ? new Date(startedAt - 1000) : null,
        heartbeat_at: ran ? new Date(done) : null,
        started_at: ran ? new Date(startedAt) : null,
        finished_at: new Date(done),
        created_at: new Date(run.createdAt),
        updated_at: new Date(done),
      });
    }
    if (failing && failing.stage === stage) broken = true;
    stageEnd.set(stage, end);
    finishedAt = Math.max(finishedAt, end);
  }
  return { rows, finishedAt: finishedAt + MINUTE / 60, jobs };
}

const STEP_NAMES = ['Check out', 'Restore cache', 'Run', 'Save cache'] as const;

/** Steps for a job, only for recent runs: older history keeps jobs, not their steps. */
export function planSteps(job: JobPlan['jobs'][number], rng: Rng): Row[] {
  const span = Math.max(4000, job.finishedAt - job.startedAt);
  return STEP_NAMES.map((name, position) => {
    const start = job.startedAt + Math.floor((span * position) / 4);
    const last = position === STEP_NAMES.length - 1;
    const state =
      job.state === 'failed'
        ? name === 'Run'
          ? 'failed'
          : last
            ? 'skipped'
            : 'passed'
        : job.state === 'passed'
          ? 'passed'
          : 'skipped';
    return {
      job_id: job.id,
      position,
      name,
      image: name === 'Run' ? 'node:24' : null,
      run: name === 'Run' ? 'pnpm test' : null,
      uses: name === 'Run' ? null : `acme/${name.toLowerCase().replace(' ', '-')}@1`,
      locked: false,
      state,
      exit_code: state === 'failed' ? 1 : state === 'passed' ? 0 : null,
      first_line: 1 + position * rng.int(40, 300),
      line_count: rng.int(20, 300),
      started_at: state === 'skipped' ? null : new Date(start),
      finished_at: state === 'skipped' ? null : new Date(start + Math.floor(span / 4)),
    };
  });
}
