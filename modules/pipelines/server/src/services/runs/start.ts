import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import type { ResolvedPipeline, Scalar } from '../../../../shared/pipeline-spec.ts';
import type { PriorityClass } from '../../../../shared/common.ts';
import type { RunTrigger } from '../../../../shared/runs.ts';
import { topicOf } from '../../../../shared/streams.ts';
import { advanceRun } from '../orchestrator/advance.ts';
import { expandJobs, type ExpandApplication, type JobPlan } from '../orchestrator/expand.ts';
import { resolvePipeline } from '../orchestrator/resolve.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { cancelJobsOf } from './cancel.ts';
import { definitionOf, templateLookup } from './templates.ts';

/*
 * Starting a run, in the caller's transaction, whatever started it (a person, the API, a
 * push, a schedule): resolve each application's pipeline at this commit, expand it into
 * jobs, queue the ones with nothing to wait for, and supersede older runs with the same key.
 * An idempotency key makes a redelivered webhook or a double click start nothing new.
 */

export interface StartApplication {
  id: string;
  key: string;
  teamId: string | null;
  pipeline: unknown;
  /** A pipeline already resolved (re-running a run exactly): used as is. */
  resolved?: ResolvedPipeline;
}

export interface StartRunInput {
  applications: readonly StartApplication[];
  repositoryId: string | null;
  trigger: RunTrigger;
  ref: string;
  commitSha: string;
  title: string;
  pullRequest?: number | null;
  authorUserId?: string | null;
  authorLogin?: string | null;
  createdBy?: string | null;
  priorityClass: PriorityClass;
  supersedeKey?: string | null;
  idempotencyKey?: string | null;
  inputs?: Record<string, Scalar>;
  variables?: Record<string, string>;
  defaultTimeoutMinutes: number;
  defaultPoolKey: string;
  rerunOfRunId?: string | null;
}

export interface StartedRun {
  id: string;
  number: number;
  /** False when the idempotency key matched a run that already existed. */
  created: boolean;
}

async function poolIds(tx: SqlExecutor, plans: JobPlan[], fallbackKey: string) {
  const keys = [...new Set([fallbackKey, ...plans.map((plan) => plan.poolKey ?? fallbackKey)])];
  const rows = await tx<{ id: string; key: string }[]>`
    select id, key from pipeline_runner_pools where key = any(${keys}::text[])`;
  const byKey = new Map(rows.map((row) => [row.key, row.id]));
  if (!byKey.has(fallbackKey)) {
    const [oldest] = await tx<{ id: string }[]>`
      select id from pipeline_runner_pools order by created_at, id limit 1`;
    if (oldest) byKey.set(fallbackKey, oldest.id);
  }
  return (key: string | null) => byKey.get(key ?? fallbackKey) ?? byKey.get(fallbackKey) ?? null;
}

async function testSeconds(tx: SqlExecutor, applicationIds: string[]) {
  const rows = await tx<{ application_id: string; seconds: number }[]>`
    select application_id, (sum(duration_ms) / 1000)::int as seconds from pipeline_test_timings
    where application_id = any(${applicationIds}::uuid[]) group by application_id`;
  return new Map(rows.map((row) => [row.application_id, Number(row.seconds)]));
}

async function insertJobs(tx: SqlExecutor, runId: string, plans: JobPlan[], input: StartRunInput) {
  const poolOf = await poolIds(tx, plans, input.defaultPoolKey);
  for (const plan of plans) {
    const [job] = await tx<{ id: string }[]>`
      insert into pipeline_jobs
        (run_id, application_id, key, name, kind, needs, pool_id, team_id, priority_class,
         supersede_key, shard_index, shard_total, timeout_minutes, matrix, steps_spec)
      values (${runId}, ${plan.applicationId}, ${plan.key}, ${plan.name}, ${plan.kind},
        ${plan.needs}::text[], ${poolOf(plan.poolKey)}::uuid, ${plan.teamId}::uuid,
        ${input.priorityClass}, ${input.supersedeKey ?? null}, ${plan.shardIndex},
        ${plan.shardTotal}, ${plan.timeoutMinutes},
        ${plan.matrix ? JSON.stringify(plan.matrix) : null}::jsonb,
        ${JSON.stringify(plan.steps)}::jsonb)
      returning id`;
    if (!job) continue;
    const steps = plan.steps.map((step, position) => ({
      job_id: job.id,
      position,
      name: step.name,
      image: step.image,
      run: step.run,
      uses: step.uses,
      locked: step.locked,
    }));
    if (steps.length > 0) await tx`insert into pipeline_steps ${tx(steps)}`;
  }
}

async function supersede(tx: SqlExecutor, run: StartedRun, key: string) {
  const older = await tx<{ id: string }[]>`
    select id from pipeline_runs
    where supersede_key = ${key} and id <> ${run.id} and state in ('queued', 'running', 'waiting')
    for update skip locked`;
  for (const { id } of older) {
    await tx`
      update pipeline_runs set superseded_by_run_id = ${run.id},
        cancel_reason = ${`Superseded by run ${run.number}`}, updated_at = now()
      where id = ${id}`;
    await cancelJobsOf(tx, id, { keepRunningDeploys: true });
    await advanceRun(tx, id);
  }
}

export async function startRun(tx: SqlExecutor, input: StartRunInput): Promise<StartedRun> {
  if (input.idempotencyKey) {
    const [existing] = await tx<{ id: string; number: number }[]>`
      select id, number from pipeline_runs where idempotency_key = ${input.idempotencyKey}`;
    if (existing) return { id: existing.id, number: Number(existing.number), created: false };
  }
  const lookup = templateLookup(tx);
  const seconds = await testSeconds(
    tx,
    input.applications.map((application) => application.id),
  );
  const expandable: ExpandApplication[] = [];
  for (const application of input.applications) {
    const definition = application.resolved ? null : definitionOf(application.pipeline);
    if (!application.resolved && !definition) {
      throw new ValidationError(
        `${application.key} has no pipeline yet. Add pipeline: to its .bemmoly/application.yaml.`,
      );
    }
    const pipeline =
      application.resolved ??
      (await resolvePipeline(definition!, lookup, {
        application: application.key,
        defaultTimeoutMinutes: input.defaultTimeoutMinutes,
        inputs: input.inputs ?? {},
      }));
    expandable.push({
      id: application.id,
      key: application.key,
      teamId: application.teamId,
      pipeline,
      testSeconds: seconds.get(application.id) ?? 0,
    });
  }
  const plans = expandJobs(expandable);
  const primary = input.applications[0];
  // One application stores its pipeline as is; a monorepo run stores one per application.
  const resolved =
    expandable.length === 1
      ? expandable[0]?.pipeline
      : { applications: expandable.map((a) => ({ key: a.key, pipeline: a.pipeline })) };
  const [run] = await tx<{ id: string; number: number }[]>`
    insert into pipeline_runs
      (repository_id, application_id, trigger, ref, commit_sha, title, pull_request,
       author_user_id, author_login, team_id, priority_class, supersede_key, idempotency_key,
       resolved_spec, inputs, variables, created_by, rerun_of_run_id)
    values (${input.repositoryId}::uuid, ${primary?.id ?? null}::uuid, ${input.trigger},
      ${input.ref}, ${input.commitSha}, ${input.title}, ${input.pullRequest ?? null},
      ${input.authorUserId ?? null}::uuid, ${input.authorLogin ?? null}, ${primary?.teamId ?? null}::uuid,
      ${input.priorityClass}, ${input.supersedeKey ?? null}, ${input.idempotencyKey ?? null},
      ${JSON.stringify(resolved ?? null)}::jsonb, ${JSON.stringify(input.inputs ?? {})}::jsonb,
      ${JSON.stringify(input.variables ?? {})}::jsonb, ${input.createdBy ?? null}::uuid,
      ${input.rerunOfRunId ?? null}::uuid)
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id, number`;
  if (!run) {
    // Another request with the same key won the race; answer with its run.
    const [existing] = await tx<{ id: string; number: number }[]>`
      select id, number from pipeline_runs where idempotency_key = ${input.idempotencyKey ?? ''}`;
    if (existing) return { id: existing.id, number: Number(existing.number), created: false };
    throw new ValidationError('The run could not be created');
  }
  const links = input.applications.map((application) => ({
    run_id: run.id,
    application_id: application.id,
  }));
  if (links.length > 0) await tx`insert into pipeline_run_applications ${tx(links)}`;
  await insertJobs(tx, run.id, plans, input);
  const started = { id: run.id, number: Number(run.number), created: true };
  if (input.supersedeKey) await supersede(tx, started, input.supersedeKey);
  await advanceRun(tx, run.id);
  await publishStreamEvent(tx, {
    topic: topicOf.live(),
    kind: 'run.updated',
    data: { id: run.id, state: 'queued', number: started.number },
  });
  for (const application of input.applications) {
    await publishStreamEvent(tx, {
      topic: topicOf.application(application.key),
      kind: 'run.updated',
      data: { id: run.id, state: 'queued', number: started.number },
    });
  }
  return started;
}
