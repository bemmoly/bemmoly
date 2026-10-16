import type { SqlClient } from '@bemmoly/core';
import type { FinishJobBody } from '../../../../shared/runner.ts';
import { topicOf } from '../../../../shared/streams.ts';
import type { LogsService } from '../logs/index.ts';
import { advanceRun, type RunOutcome } from '../orchestrator/advance.ts';
import { publishStreamEvent } from '../streams/publish.ts';
import { fingerprintOf } from '../tests/index.ts';
import type { JobIdentity } from './auth.ts';

/*
 * A job's end, as its runner reports it. A job that was cancelled, superseded or timed out
 * while running keeps that state: the runner's report arrives after the decision. A job
 * that failed only because quarantined tests failed passes, with the reason on it. The first
 * error line becomes the failure summary and its fingerprint groups it with the same failure
 * elsewhere.
 */

export type FinishInput = Omit<FinishJobBody, 'imageDigests'> & {
  imageDigests?: FinishJobBody['imageDigests'];
};

const LIVE = ['claimed', 'running'];

function quarantinedOnly(job: JobIdentity): boolean {
  const failed = job.test_summary?.failed ?? 0;
  return failed > 0 && failed === (job.test_summary?.quarantined ?? 0);
}

export async function finishJob(
  sql: SqlClient,
  logs: LogsService,
  job: JobIdentity,
  body: FinishInput,
): Promise<RunOutcome | null> {
  if (!LIVE.includes(job.state)) {
    await sql`
      update pipeline_runners set state = 'idle', current_job_id = null, updated_at = now()
      where id = ${job.runner_id}::uuid and current_job_id = ${job.id}`;
    return null;
  }
  let state: string = body.state;
  let summary = body.failureSummary ?? null;
  let line: string | null = null;
  if (state === 'failed' && quarantinedOnly(job)) {
    state = 'passed';
    summary = `${job.test_summary?.quarantined ?? 0} quarantined tests failed; they do not fail the run`;
  } else if (state === 'failed') {
    line = (await logs.firstErrorText(sql, job.id)) ?? summary;
    summary = summary ?? line ?? 'The job failed';
  }
  return sql.begin(async (tx) => {
    const updated = await tx`
      update pipeline_jobs set state = ${state}, finished_at = ${body.at}::timestamptz,
        started_at = coalesce(started_at, ${body.at}::timestamptz),
        failure_summary = ${summary}, failure_line = ${line},
        failure_fingerprint = ${fingerprintOf(line)},
        image_digests = ${body.imageDigests ? JSON.stringify(body.imageDigests) : null}::jsonb,
        updated_at = now()
      where id = ${job.id} and state in ('claimed', 'running')
      returning id`;
    if (updated.length === 0) return null;
    const fingerprint = fingerprintOf(line);
    if (line && fingerprint) {
      await tx`
        insert into pipeline_job_failures (job_id, run_id, application_id, attempt, line, fingerprint)
        values (${job.id}, ${job.run_id}, ${job.application_id}::uuid, ${job.attempt}, ${line},
          ${fingerprint})`;
    }
    await tx`
      update pipeline_steps set state = 'skipped', updated_at = now()
      where job_id = ${job.id} and state = 'pending'`;
    await tx`
      update pipeline_runners set state = 'idle', current_job_id = null, updated_at = now()
      where id = ${job.runner_id}::uuid`;
    await publishStreamEvent(tx, {
      topic: topicOf.run(job.run_id),
      kind: 'job.updated',
      data: { id: job.id, runId: job.run_id, state },
    });
    await publishStreamEvent(tx, { topic: topicOf.capacity(), kind: 'capacity.updated', data: {} });
    return advanceRun(tx, job.run_id);
  });
}
