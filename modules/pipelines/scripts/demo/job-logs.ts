import type { SqlClient, SqlExecutor } from '@bemmoly/core';
import { isErrorLine, parseAnsi } from '../../server/src/services/logs/ansi.ts';
import {
  chunkKey,
  createChunkStore,
  type LogObjects,
} from '../../server/src/services/logs/store.ts';
import { fingerprintOf, ingestReport } from '../../server/src/services/tests/index.ts';
import { insertMany, type Row } from './bulk.ts';
import { jobOutput, type JobOutput } from './log-lines.ts';
import { createRng } from './rng.ts';

/*
 * Job logs and test results for the demo, stored where the server reads them: one chunk per
 * step in Pipelines' object store, indexed in pipeline_log_chunks, and JUnit summaries
 * through the same ingest the runner protocol uses. A failing job also gets its first error
 * line and a failure record, as the runner's finish would leave them.
 */

export interface OutputJob {
  id: string;
  run_id: string;
  application_id: string | null;
  attempt: number;
  key: string;
  name: string;
  kind: string;
  state: string;
  app_key: string;
  commit_sha: string;
  mainline: boolean;
}

/** The same job always prints the same lines, however often it is asked. */
export function outputOf(job: OutputJob): JobOutput {
  const seed = Number.parseInt(job.id.replaceAll('-', '').slice(-8), 16);
  return jobOutput(
    {
      key: job.key,
      name: job.name,
      kind: job.kind,
      failed: job.state === 'failed',
      appKey: job.app_key,
    },
    createRng(seed),
  );
}

export function firstError(output: JobOutput): string | null {
  for (const lines of output.steps) {
    for (const line of lines) {
      const { text, spans } = parseAnsi(line);
      if (isErrorLine(text, spans)) return text.trim();
    }
  }
  return null;
}

/** The report and the failure line, as the runner's report upload and finish write them. */
export async function recordResults(
  tx: SqlExecutor,
  job: OutputJob,
  output: JobOutput,
  at: Date | null = null,
) {
  if (output.report) await ingestReport(tx, job, output.report);
  const line = job.state === 'failed' ? firstError(output) : null;
  const fingerprint = fingerprintOf(line);
  if (!line || !fingerprint) return;
  await tx`
    update pipeline_jobs set failure_line = ${line}, failure_fingerprint = ${fingerprint}
    where id = ${job.id}`;
  await tx`
    insert into pipeline_job_failures (job_id, run_id, application_id, attempt, line,
      fingerprint, created_at)
    values (${job.id}, ${job.run_id}, ${job.application_id}::uuid, ${job.attempt}, ${line},
      ${fingerprint}, coalesce(${at?.toISOString() ?? null}::timestamptz, now()))`;
}

/** Jobs as the writers need them, with their run's commit and their application's key. */
export function selectJobs(sql: SqlExecutor) {
  return sql`
    select j.id, j.run_id, j.application_id, j.attempt, j.key, j.name, j.kind, j.state,
      coalesce(a.key, 'app') as app_key, r.commit_sha, r.ref = 'main' as mainline,
      j.finished_at
    from pipeline_jobs j
    join pipeline_runs r on r.id = j.run_id
    left join pipeline_applications a on a.id = j.application_id`;
}

/**
 * Logs and results for every failing job and every job of the most recent runs. Older
 * passing history keeps its jobs without logs, as retention would have left it, so the
 * full Acme still seeds in minutes.
 */
export async function seedJobLogs(
  sql: SqlClient,
  objects: LogObjects | undefined,
  recentRuns: number,
): Promise<{ jobs: number; chunks: number }> {
  const store = createChunkStore(objects);
  const jobs = await sql<(OutputJob & { finished_at: Date | null })[]>`
    ${selectJobs(sql)}
    where j.state in ('passed', 'failed')
      and (j.state = 'failed' or j.run_id in (
        select id from pipeline_runs where state in ('passed', 'failed')
        order by created_at desc limit ${recentRuns}))
    order by j.id`;
  const steps = await sql<{ id: string; job_id: string; position: number }[]>`
    select id, job_id, position from pipeline_steps where job_id = any(${jobs.map((j) => j.id)}::uuid[])`;
  const stepOf = new Map(steps.map((s) => [`${s.job_id}/${s.position}`, s.id]));
  const chunks: Row[] = [];
  for (const job of jobs) {
    const output = outputOf(job);
    let line = 1;
    for (const [position, lines] of output.steps.entries()) {
      if (lines.length === 0) continue;
      const key = chunkKey(job.id, job.attempt, position);
      const size = await store.write(key, lines);
      chunks.push({
        job_id: job.id,
        step_id: stepOf.get(`${job.id}/${position}`) ?? null,
        seq: position,
        first_line: line,
        line_count: lines.length,
        byte_size: size,
        object_key: key,
        has_error: lines.some((l) => {
          const { text, spans } = parseAnsi(l);
          return isErrorLine(text, spans);
        }),
      });
      line += lines.length;
    }
    if (output.report || job.state === 'failed') {
      await recordResults(sql, job, output, job.finished_at ? new Date(job.finished_at) : null);
    }
  }
  await insertMany(sql, 'pipeline_log_chunks', chunks);
  await sql`
    update pipeline_steps s set first_line = c.first_line, line_count = c.line_count
    from pipeline_log_chunks c where c.step_id = s.id`;
  return { jobs: jobs.length, chunks: chunks.length };
}
