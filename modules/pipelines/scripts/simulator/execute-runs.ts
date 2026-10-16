import type { SqlExecutor } from '@bemmoly/core';
import { ConflictError } from '@bemmoly/shared';
import { advanceRun } from '../../server/src/services/orchestrator/advance.ts';
import { liveCounter } from '../../server/src/services/overview/index.ts';
import { createReleaseWriter } from '../../server/src/services/releases/index.ts';
import { publishStreamEvent } from '../../server/src/services/streams/publish.ts';
import { topicOf } from '../../shared/streams.ts';
import type { Action, SimCatalog, SimJob } from './model.ts';

/*
 * Runs and jobs in the database, written the way the run starter, the dispatcher and the
 * runner protocol write them, and moved on by the real orchestrator (advanceRun), so the
 * Runs list, the Run page and the live counter hear exactly what they hear from runners.
 * Every update names the state it expects: a row someone else moved is left alone.
 */

type RunStart = Extract<Action, { kind: 'run.start' }>;
type JobStart = Extract<Action, { kind: 'job.start' }>;
type JobFinish = Extract<Action, { kind: 'job.finish' }>;

const PASSED = { total: 120, passed: 118, failed: 0, skipped: 2 };
const FAILED = { total: 120, passed: 116, failed: 2, skipped: 2 };

const STEPS = ['Check out', 'Restore cache', 'Run', 'Save cache'] as const;

const COMMANDS: Readonly<Record<SimJob['kind'], string>> = {
  build: 'docker buildx build --push .',
  test: 'pnpm test',
  scan: 'bemmoly scan --fail-on high',
  publish: 'bemmoly release publish',
};

/** The top bar's counter, recounted, so every open top bar moves with the jobs. */
export async function publishCounter(tx: SqlExecutor): Promise<void> {
  const data = await liveCounter(tx, { domain: null, group: null });
  await publishStreamEvent(tx, { topic: topicOf.live(), kind: 'counter', data });
}

export async function startRunRows(tx: SqlExecutor, catalog: SimCatalog, action: RunStart) {
  const { run } = action;
  const app = catalog.apps.find((a) => a.id === run.appId);
  if (!app) return false;
  const priority = run.main ? 'main' : 'pull_request';
  const [row] = await tx<{ number: number }[]>`
    insert into pipeline_runs (id, repository_id, application_id, trigger, ref, commit_sha, title,
      pull_request, author_user_id, team_id, priority_class, supersede_key)
    values (${run.id}, ${app.repositoryId}::uuid, ${app.id}, ${run.main ? 'push' : 'pull_request'},
      ${run.main ? 'main' : `pull/${action.pullRequest ?? 0}`}, ${action.sha}, ${action.title},
      ${action.pullRequest}, ${run.authorId}::uuid, ${app.teamId}::uuid, ${priority},
      ${action.pullRequest ? `${app.key}#${action.pullRequest}` : null})
    returning number`;
  await tx`insert into pipeline_run_applications (run_id, application_id)
    values (${run.id}, ${app.id})`;
  for (const job of run.jobs) {
    await tx`
      insert into pipeline_jobs (id, run_id, application_id, key, name, kind, needs, pool_id,
        team_id, priority_class)
      values (${job.id}, ${run.id}, ${app.id}, ${job.key}, ${job.name}, ${job.kind},
        ${job.needs}::text[], ${job.poolId}::uuid, ${app.teamId}::uuid, ${priority})`;
    const steps = STEPS.map((name, position) => ({
      job_id: job.id,
      position,
      name,
      image: name === 'Run' ? 'node:24' : null,
      run: name === 'Run' ? COMMANDS[job.kind] : null,
      uses: name === 'Run' ? null : `acme/${name.toLowerCase().replace(' ', '-')}@1`,
    }));
    await tx`insert into pipeline_steps ${tx(steps)}`;
  }
  await advanceRun(tx, run.id);
  const data = { id: run.id, state: 'queued', number: Number(row?.number ?? 0) };
  await publishStreamEvent(tx, { topic: topicOf.live(), kind: 'run.updated', data });
  await publishStreamEvent(tx, { topic: topicOf.application(app.key), kind: 'run.updated', data });
  await publishCounter(tx);
  return true;
}

/** An idle runner in the job's pool takes it; the pool grows by one when none is idle. */
async function runnerFor(tx: SqlExecutor, jobId: string, poolId: string | null) {
  if (!poolId) return null;
  const [idle] = await tx<{ id: string }[]>`
    update pipeline_runners set state = 'busy', current_job_id = ${jobId},
      last_heartbeat_at = now(), updated_at = now()
    where id = (select id from pipeline_runners where pool_id = ${poolId} and state = 'idle'
      order by id limit 1 for update skip locked)
    returning id`;
  if (idle) return idle.id;
  const [created] = await tx<{ id: string }[]>`
    insert into pipeline_runners (pool_id, name, version, state, labels, current_job_id,
      last_heartbeat_at)
    values (${poolId}, ${`runner-${jobId.slice(-8)}`}, '0.1.0', 'busy', ${['linux-x64']}::text[],
      ${jobId}, now())
    returning id`;
  return created?.id ?? null;
}

export async function startJobRows(tx: SqlExecutor, action: JobStart) {
  const [job] = await tx<{ pool_id: string | null }[]>`
    select pool_id from pipeline_jobs
    where id = ${action.jobId} and state = 'ready' and token_hash is null for update`;
  if (!job) return false;
  const runner = await runnerFor(tx, action.jobId, job.pool_id);
  await tx`
    update pipeline_jobs set state = 'running', runner_id = ${runner}::uuid, claimed_at = now(),
      heartbeat_at = now(), started_at = now(), updated_at = now()
    where id = ${action.jobId}`;
  await tx`update pipeline_steps set state = 'running', started_at = now(), updated_at = now()
    where job_id = ${action.jobId} and position = 0`;
  const data = { id: action.jobId, runId: action.runId, state: 'running' };
  await publishStreamEvent(tx, { topic: topicOf.run(action.runId), kind: 'job.updated', data });
  await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
  await advanceRun(tx, action.runId);
  await publishCounter(tx);
  return true;
}

export async function finishJobRows(tx: SqlExecutor, catalog: SimCatalog, action: JobFinish) {
  const state = action.passed ? 'passed' : 'failed';
  const [job] = await tx<{ runner_id: string | null; kind: string }[]>`
    update pipeline_jobs set state = ${state}, finished_at = now(),
      started_at = coalesce(started_at, now()), updated_at = now(),
      failure_summary = ${action.passed ? null : '2 tests failed'},
      test_summary = ${JSON.stringify(action.passed ? PASSED : FAILED)}::jsonb
    where id = ${action.jobId} and state in ('claimed', 'running') and token_hash is null
    returning runner_id, kind`;
  if (!job) return false;
  // Every step but the last passed; a failing job fails in Run and skips what follows.
  await tx`
    update pipeline_steps set
      state = case when ${action.passed} then 'passed'
        when name = 'Run' then 'failed' when position < 2 then 'passed' else 'skipped' end,
      exit_code = case when ${action.passed} or position < 2 then 0
        when name = 'Run' then 1 else null end,
      started_at = coalesce(started_at, now()), finished_at = now(), updated_at = now()
    where job_id = ${action.jobId}`;
  await tx`update pipeline_runners set state = 'idle', current_job_id = null, updated_at = now()
    where id = ${job.runner_id}::uuid`;
  const data = { id: action.jobId, runId: action.runId, state };
  await publishStreamEvent(tx, { topic: topicOf.run(action.runId), kind: 'job.updated', data });
  await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
  const outcome = await advanceRun(tx, action.runId);
  await publishCounter(tx);
  if (outcome.finished) await creditAuthor(tx, catalog, action.runId);
  return true;
}

/**
 * The release a passing main run makes, through the one release writer. The writer picks the
 * id, and the planned Dev deployment (the same object the planner tracks) follows it. False
 * when there is no release to deploy, such as a version that already exists.
 */
export async function releaseRows(tx: SqlExecutor, catalog: SimCatalog, action: JobFinish) {
  const { release } = action;
  const app = catalog.apps.find((a) => a.id === release?.appId);
  const [run] = await tx<{ commit_sha: string }[]>`
    select commit_sha from pipeline_runs where id = ${action.runId}`;
  if (!release || !app || !run) return false;
  try {
    const created = await createReleaseWriter().createRelease(tx, {
      applicationId: app.id,
      version: release.version,
      source: 'runners',
      commitSha: run.commit_sha,
      ref: 'main',
      imageRepository: `asia-south1-docker.pkg.dev/acme-ci/${app.domainKey}/${app.key}`,
      imageDigests: { 'linux/amd64': `sha256:${release.id.replaceAll('-', '').padEnd(64, '0')}` },
      testSummary: PASSED,
      createdBy: release.authorId,
      runId: action.runId,
    });
    release.id = created.release.id;
    if (action.deployment) action.deployment.releaseId = created.release.id;
    return created.created;
  } catch (error) {
    if (error instanceof ConflictError) return false;
    throw error;
  }
}

/** A finished run of the demo person's own is news on their For you. */
async function creditAuthor(tx: SqlExecutor, catalog: SimCatalog, runId: string) {
  if (!catalog.demoId) return;
  const [run] = await tx<{ mine: boolean }[]>`
    select author_user_id = ${catalog.demoId}::uuid as mine from pipeline_runs where id = ${runId}`;
  if (run?.mine) {
    await publishStreamEvent(tx, {
      topic: topicOf.forYou(),
      kind: 'for-you.changed',
      userId: catalog.demoId,
      data: {},
    });
  }
}
