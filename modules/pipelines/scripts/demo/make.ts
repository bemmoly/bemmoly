import { insertMany } from './bulk.ts';
import type { Current } from './deploys.ts';
import { planJobs, planSteps } from './jobs.ts';
import { MINUTE, uuidv7 } from './rng.ts';
import type { AppInfo, EnvInfo, World } from './world.ts';

/*
 * One-off rows for the live picture: a run with its jobs, a release, a deployment with its
 * events. History is generated in bulk; these are the few dozen things in motion right now
 * and the demo person's own changes, written one at a time so each can be exact.
 */

/** What moves right now, laid over the history's current state before it is written. */
export interface Moving {
  state: 'deploying' | 'canary' | 'waiting' | 'failed' | 'rolled_back';
  releaseId: string;
  version: string;
  traffic: number;
}

export interface LiveState {
  current: Map<string, Current>;
  moving: Map<string, Moving>;
}

export const targetKey = (app: AppInfo, target: EnvInfo) => `${app.id}/${target.id}`;

export interface RunInput {
  app: AppInfo;
  apps?: AppInfo[];
  title: string;
  sha?: string;
  issueKey?: string | null;
  authorId: string | null;
  main: boolean;
  state: 'passed' | 'failed';
  createdAt: number;
  pullRequest?: number;
  shards?: number;
  failKey?: string;
}

export async function makeRun(world: World, input: RunInput) {
  const { rng, sql } = world;
  const id = uuidv7(rng, input.createdAt);
  const apps = input.apps ?? [input.app];
  const shape = {
    id,
    apps,
    monorepo: input.app.repoFullName.endsWith('-mono'),
    main: input.main,
    state: input.state,
    priorityClass: input.main ? 'main' : 'pull_request',
    teamId: input.app.ownerTeam?.id ?? null,
    createdAt: input.createdAt,
    startedAt: input.createdAt + 20_000,
  };
  const plan = planJobs(
    shape,
    rng,
    world.pools.map((p) => p.id),
    {
      ...(input.shards ? { shards: input.shards } : {}),
      ...(input.failKey ? { failKey: input.failKey } : {}),
    },
  );
  await insertMany(sql, 'pipeline_runs', [
    {
      id,
      application_id: input.app.id,
      repository_id: input.app.repoId,
      trigger: input.main ? 'push' : 'pull_request',
      ref: input.main ? 'main' : `pull/${input.pullRequest ?? 0}`,
      commit_sha: input.sha ? input.sha.padEnd(40, rng.hex(40)) : rng.hex(40),
      title: input.title,
      pull_request: input.pullRequest ?? null,
      issue_key: input.issueKey ?? null,
      author_user_id: input.authorId,
      team_id: shape.teamId,
      state: input.state,
      priority_class: shape.priorityClass,
      executor: 'runners',
      started_at: new Date(shape.startedAt),
      finished_at: new Date(plan.finishedAt),
      created_at: new Date(input.createdAt),
      updated_at: new Date(plan.finishedAt),
    },
  ]);
  await insertMany(
    sql,
    'pipeline_run_applications',
    apps.map((a) => ({ run_id: id, application_id: a.id })),
  );
  await insertMany(sql, 'pipeline_jobs', plan.rows);
  await insertMany(
    sql,
    'pipeline_steps',
    plan.jobs.flatMap((job) => planSteps(job, rng)),
  );
  return { id, finishedAt: plan.finishedAt, jobs: plan.jobs };
}

export async function makeRelease(
  world: World,
  input: {
    app: AppInfo;
    version: string;
    runId: string | null;
    authorId: string | null;
    createdAt: number;
  },
) {
  const id = uuidv7(world.rng, input.createdAt);
  await world.sql`
    insert into pipeline_releases (id, application_id, version, source, run_id, commit_sha, ref,
      image_repository, image_digests, test_summary, created_by, created_at, updated_at)
    values (${id}, ${input.app.id}, ${input.version}, 'runners', ${input.runId},
      ${world.rng.hex(40)}, 'main',
      ${`asia-south1-docker.pkg.dev/acme-ci/${input.app.domainKey}/${input.app.key}`},
      ${JSON.stringify({ 'linux/amd64': `sha256:${world.rng.hex(64)}` })}::jsonb,
      ${JSON.stringify({ passed: 198, failed: 0, skipped: 2 })}::jsonb,
      ${input.authorId}, ${new Date(input.createdAt).toISOString()}::timestamptz,
      ${new Date(input.createdAt).toISOString()}::timestamptz)
    on conflict (application_id, version) do nothing`;
  const [row] = await world.sql<{ id: string }[]>`
    select id from pipeline_releases where application_id = ${input.app.id} and version = ${input.version}`;
  return row?.id ?? id;
}

/** A deployment that reached `state` (finished or still moving) with an event per step. */
export async function makeDeployment(
  world: World,
  input: {
    app: AppInfo;
    target: EnvInfo;
    releaseId: string;
    state: string;
    traffic: number;
    startedAt: number;
    authorId: string | null;
    promotionId?: string | null;
    wave?: number;
    kind?: 'deploy' | 'rollback';
    rollbackOf?: string | null;
    steps?: readonly (readonly [string, number])[];
  },
) {
  const id = uuidv7(world.rng, input.startedAt);
  const done = ['succeeded', 'failed', 'rolled_back', 'cancelled'].includes(input.state);
  const steps = input.steps ?? [
    ['pending', 0],
    ['deploying', 0],
    [input.state, input.traffic],
  ];
  const events = steps.map(([state, traffic], index) => ({
    deployment_id: id,
    application_id: input.app.id,
    environment_id: input.target.id,
    release_id: input.releaseId,
    state,
    traffic_percent: traffic,
    message: null,
    data: {},
    occurred_at: new Date(input.startedAt + index * 2 * MINUTE),
  }));
  const last = input.startedAt + (steps.length - 1) * 2 * MINUTE;
  await insertMany(world.sql, 'pipeline_deployments', [
    {
      id,
      promotion_id: input.promotionId ?? null,
      release_id: input.releaseId,
      application_id: input.app.id,
      environment_id: input.target.id,
      kind: input.kind ?? 'deploy',
      wave: input.wave ?? 1,
      state: input.state,
      traffic_percent: input.traffic,
      revision: null,
      rollback_of_id: input.rollbackOf ?? null,
      started_by: input.authorId,
      started_at: input.state === 'pending' ? null : new Date(input.startedAt),
      finished_at: done ? new Date(last) : null,
      created_at: new Date(input.startedAt),
    },
  ]);
  if (input.state !== 'pending') await insertMany(world.sql, 'pipeline_deployment_events', events);
  return { id, at: last };
}
