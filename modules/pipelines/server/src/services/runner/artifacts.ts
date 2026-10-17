import type { ModuleObjects, SqlExecutor } from '@bemmoly/core';
import { ProviderError } from '@bemmoly/shared';
import type { JobArtifact } from '../../../../shared/runner.ts';
import { iso } from '../../utils/time.ts';

/** A file a job keeps, stored under its job; uploading the same name again replaces it. */
export async function uploadArtifact(
  sql: SqlExecutor,
  objects: Pick<ModuleObjects, 'put'> | undefined,
  job: { id: string },
  name: string,
  body: Buffer,
  contentType: string,
): Promise<JobArtifact> {
  if (!objects) throw new ProviderError('Artifacts need object storage, which is not set up');
  const key = `artifacts/${job.id}/${name}`;
  await objects.put({ key, body, contentType, size: body.length });
  const [row] = await sql<{ id: string; created_at: Date | string }[]>`
    insert into pipeline_job_artifacts (job_id, name, object_key, size, content_type)
    values (${job.id}, ${name}, ${key}, ${body.length}, ${contentType})
    on conflict (job_id, name) do update set size = excluded.size,
      content_type = excluded.content_type, updated_at = now()
    returning id, created_at`;
  if (!row) throw new ProviderError('The artifact could not be recorded');
  return { id: row.id, name, size: body.length, contentType, createdAt: iso(row.created_at) };
}
