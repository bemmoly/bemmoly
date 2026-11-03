import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { isBemmolyError } from '@bemmoly/shared';
import { topicOf } from '../../../../shared/streams.ts';
import { advanceRun, type RunOutcome } from '../orchestrator/advance.ts';
import type { ReleaseWriter } from '../releases/index.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { deployConfigOf, repositoryOf } from './release.ts';
import { runVersion } from './versions.ts';

/*
 * Deploy steps of a run ("Deploy" under an environment in the editor). No runner takes them:
 * when one is ready, Pipelines makes the version from the run's passed build (the same image,
 * the same version the run ends with) and asks shipping to deploy it there, as auto-promote
 * does; the step passes when that deployment is healthy and fails, saying why, when it is
 * not. The minute sweep and every job change call this, so a lost wake-up costs a minute.
 */

export interface DeployStepPorts {
  sql: SqlClient;
  writer: ReleaseWriter;
  /** Asks shipping to deploy a release into an environment; throws when it cannot. */
  promote: (release: string, environment: string, note: string) => Promise<{ id: string }>;
}

interface StepRow {
  id: string;
  run_id: string;
  application_id: string;
  application_key: string;
  environment_key: string;
  state: string;
}

async function setState(tx: SqlExecutor, step: StepRow, state: string, summary: string | null) {
  const finished = state === 'passed' || state === 'failed';
  await tx`
    update pipeline_jobs set state = ${state}, failure_summary = ${summary},
      started_at = coalesce(started_at, now()),
      finished_at = case when ${finished} then now() else finished_at end, updated_at = now()
    where id = ${step.id}`;
  await publishStreamEvent(tx, {
    topic: topicOf.run(step.run_id),
    kind: 'job.updated',
    data: { id: step.id, runId: step.run_id, state },
  });
}

/** The release this run's build became, made now if the run has not finished yet. */
async function releaseOf(ports: DeployStepPorts, step: StepRow): Promise<string | null> {
  const { sql } = ports;
  const [existing] = await sql<{ id: string }[]>`
    select id from pipeline_releases
    where run_id = ${step.run_id} and application_id = ${step.application_id}
    order by created_at desc limit 1`;
  if (existing) return existing.id;
  const [build] = await sql<
    {
      image_digests: Record<string, string>;
      steps_spec: unknown;
      commit_sha: string;
      ref: string;
      created_by: string | null;
      resolved_spec: unknown;
    }[]
  >`
    select b.image_digests, b.steps_spec, r.commit_sha, r.ref, r.created_by, r.resolved_spec
    from pipeline_jobs b join pipeline_runs r on r.id = b.run_id
    where b.run_id = ${step.run_id} and b.application_id = ${step.application_id}
      and b.kind = 'build' and b.state = 'passed' and b.image_digests is not null
    limit 1`;
  if (!build) return null;
  const version = await runVersion(sql, step.run_id, step.application_id);
  const { release } = await sql.begin((tx) =>
    ports.writer.createRelease(tx, {
      applicationId: step.application_id,
      version,
      source: 'runners',
      commitSha: build.commit_sha,
      ref: build.ref,
      imageRepository: repositoryOf(build.steps_spec, step.application_key),
      imageDigests: build.image_digests,
      resolvedConfig: deployConfigOf(build.resolved_spec, step.application_key),
      createdBy: build.created_by,
      runId: step.run_id,
    }),
  );
  return release.id;
}

async function start(ports: DeployStepPorts, step: StepRow): Promise<void> {
  const release = await releaseOf(ports, step);
  if (!release) {
    await setState(
      ports.sql,
      step,
      'failed',
      'Nothing to deploy: no build in this run made an image',
    );
    return;
  }
  try {
    await ports.promote(release, step.environment_key, `Deployed by a step of run ${step.run_id}`);
    await setState(ports.sql, step, 'running', null);
  } catch (error) {
    if (!isBemmolyError(error)) throw error;
    await setState(
      ports.sql,
      step,
      'failed',
      `Could not deploy to ${step.environment_key}: ${error.message}`,
    );
  }
}

async function follow(ports: DeployStepPorts, step: StepRow): Promise<void> {
  const [found] = await ports.sql<
    { deploy_state: string | null; promotion_state: string | null; reason: string | null }[]
  >`
    select d.state as deploy_state, p.state as promotion_state, p.outcome_reason as reason
    from pipeline_releases rl
    join pipeline_environments e on e.key = ${step.environment_key}
    left join lateral (select state, outcome_reason from pipeline_promotions
      where release_id = rl.id and environment_id = e.id order by created_at desc limit 1) p on true
    left join lateral (select state from pipeline_deployments
      where release_id = rl.id and environment_id = e.id order by created_at desc limit 1) d on true
    where rl.run_id = ${step.run_id} and rl.application_id = ${step.application_id}
    order by rl.created_at desc limit 1`;
  if (!found) return;
  if (found.deploy_state === 'succeeded') {
    await setState(ports.sql, step, 'passed', null);
  } else if (['failed', 'rolled_back', 'cancelled'].includes(found.deploy_state ?? '')) {
    await setState(
      ports.sql,
      step,
      'failed',
      `The deployment to ${step.environment_key} ${found.deploy_state?.replace('_', ' ')}`,
    );
  } else if (['failed', 'cancelled', 'rolled_back'].includes(found.promotion_state ?? '')) {
    await setState(
      ports.sql,
      step,
      'failed',
      found.reason ?? `The deploy to ${step.environment_key} stopped`,
    );
  }
}

/** Starts ready deploy steps and settles running ones; answers each run that moved. */
export async function advanceDeploySteps(ports: DeployStepPorts): Promise<RunOutcome[]> {
  const steps = await ports.sql<StepRow[]>`
    select j.id, j.run_id, j.application_id, a.key as application_key, j.environment_key, j.state
    from pipeline_jobs j join pipeline_applications a on a.id = j.application_id
    where j.kind = 'deploy' and j.state in ('ready', 'running') and j.environment_key is not null
    order by j.created_at limit 50`;
  const runs = new Set<string>();
  for (const step of steps) {
    if (step.state === 'ready') await start(ports, step);
    else await follow(ports, step);
    runs.add(step.run_id);
  }
  const outcomes: RunOutcome[] = [];
  for (const runId of runs) outcomes.push(await ports.sql.begin((tx) => advanceRun(tx, runId)));
  return outcomes;
}
