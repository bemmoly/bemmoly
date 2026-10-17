import type { SqlExecutor } from '@bemmoly/core';
import { ValidationError } from '@bemmoly/shared';
import { topicOf } from '../../../../shared/streams.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { startRun, supersede, type StartRunInput, type StartedRun } from './start.ts';

/*
 * A run that could not start: an application.yaml that does not read, a pipeline that does
 * not resolve (a missing template, a bad input, steps that wait on each other). A push must
 * never vanish without a trace, so it becomes a failed run that says why, on Runs and as a
 * failed check on the commit, where the author looks for their build. It takes the same
 * idempotency key a started run would, so a redelivered event records it once.
 */

export interface StartOutcome extends StartedRun {
  /** True when the run was recorded as failed before any job, with its reason. */
  failed: boolean;
}

export async function recordFailedRun(
  tx: SqlExecutor,
  input: StartRunInput,
  reason: string,
): Promise<StartOutcome> {
  if (input.idempotencyKey) {
    const [existing] = await tx<{ id: string; number: number; state: string }[]>`
      select id, number, state from pipeline_runs where idempotency_key = ${input.idempotencyKey}`;
    if (existing) {
      return {
        id: existing.id,
        number: Number(existing.number),
        created: false,
        failed: existing.state === 'failed',
      };
    }
  }
  const primary = input.applications[0];
  const [run] = await tx<{ id: string; number: number }[]>`
    insert into pipeline_runs
      (repository_id, application_id, trigger, ref, commit_sha, title, pull_request,
       author_user_id, author_login, team_id, priority_class, supersede_key, idempotency_key,
       state, failure_reason, finished_at, created_by, rerun_of_run_id, from_fork)
    values (${input.repositoryId}::uuid, ${primary?.id ?? null}::uuid, ${input.trigger},
      ${input.ref}, ${input.commitSha}, ${input.title}, ${input.pullRequest ?? null},
      ${input.authorUserId ?? null}::uuid, ${input.authorLogin ?? null},
      ${primary?.teamId ?? null}::uuid, ${input.priorityClass}, ${input.supersedeKey ?? null},
      ${input.idempotencyKey ?? null}, 'failed', ${reason}, now(), ${input.createdBy ?? null}::uuid,
      ${input.rerunOfRunId ?? null}::uuid, ${input.fromFork ?? false})
    on conflict (idempotency_key) where idempotency_key is not null do nothing
    returning id, number`;
  if (!run) {
    const [existing] = await tx<{ id: string; number: number; state: string }[]>`
      select id, number, state from pipeline_runs where idempotency_key = ${input.idempotencyKey ?? ''}`;
    if (!existing) throw new ValidationError('The run could not be created');
    return {
      id: existing.id,
      number: Number(existing.number),
      created: false,
      failed: existing.state === 'failed',
    };
  }
  const links = input.applications.map((application) => ({
    run_id: run.id,
    application_id: application.id,
  }));
  if (links.length > 0) await tx`insert into pipeline_run_applications ${tx(links)}`;
  const started = { id: run.id, number: Number(run.number), created: true };
  // The newer commit is what the author cares about, even when it is the broken one.
  if (input.supersedeKey) await supersede(tx, started, input.supersedeKey);
  const data = { id: run.id, state: 'failed', number: started.number };
  await publishStreamEvent(tx, { topic: topicOf.live(), kind: 'run.updated', data });
  for (const application of input.applications) {
    await publishStreamEvent(tx, {
      topic: topicOf.application(application.key),
      kind: 'run.updated',
      data,
    });
  }
  return { ...started, failed: true };
}

/**
 * Starts the run, or records it as failed when its pipeline does not resolve. Only a
 * ValidationError means the pipeline is wrong; anything else is ours and is thrown.
 */
export async function startOrRecordFailure(
  tx: SqlExecutor,
  input: StartRunInput,
): Promise<StartOutcome> {
  try {
    return { ...(await startRun(tx, input)), failed: false };
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return recordFailedRun(tx, input, error.message);
  }
}
