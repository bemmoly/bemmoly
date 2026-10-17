import type { ModuleObjects, SqlClient } from '@bemmoly/core';

/*
 * Logs and artifacts stay hot for `pipelines.logs.retentionDays` (architecture §19), then go:
 * objects first, then their rows, a batch at a time, so a large backlog drains over several
 * nights without one long transaction. Failures, test history and run summaries stay.
 */

const BATCH = 2000;

export async function expireLogs(
  sql: SqlClient,
  objects: Pick<ModuleObjects, 'delete'> | undefined,
  retentionDays: number,
): Promise<{ chunks: number; artifacts: number }> {
  const before = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
  const chunks = await sql<{ id: string; object_key: string }[]>`
    select c.id, c.object_key from pipeline_log_chunks c
    join pipeline_jobs j on j.id = c.job_id
    where j.finished_at < ${before}::timestamptz
    limit ${BATCH}`;
  const artifacts = await sql<{ id: string; object_key: string }[]>`
    select a.id, a.object_key from pipeline_job_artifacts a
    join pipeline_jobs j on j.id = a.job_id
    where j.finished_at < ${before}::timestamptz
    limit ${BATCH}`;
  for (const row of [...chunks, ...artifacts]) await objects?.delete(row.object_key);
  if (chunks.length > 0) {
    await sql`delete from pipeline_log_chunks where id = any(${chunks.map((c) => c.id)}::uuid[])`;
  }
  if (artifacts.length > 0) {
    await sql`
      delete from pipeline_job_artifacts where id = any(${artifacts.map((a) => a.id)}::uuid[])`;
  }
  return { chunks: chunks.length, artifacts: artifacts.length };
}
