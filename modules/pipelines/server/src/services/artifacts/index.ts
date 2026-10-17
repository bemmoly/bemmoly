import type { Readable } from 'node:stream';
import type { ModuleObjects, RequestContext } from '@bemmoly/core';
import { NotFoundError, ProviderError } from '@bemmoly/shared';
import type { JobArtifact } from '../../../../shared/runner.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { iso } from '../../utils/time.ts';

/** Files jobs kept, listed and downloaded by anyone who may use Pipelines. */
export function createArtifactsService(
  deps: PipelinesServiceDeps & { objects?: Pick<ModuleObjects, 'get'> },
) {
  return {
    async list(ctx: RequestContext, jobId: string): Promise<{ items: JobArtifact[] }> {
      await authorizePipelines(ctx);
      const rows = await requireDatabase(deps)<
        {
          id: string;
          name: string;
          size: string | number;
          content_type: string;
          created_at: Date | string;
        }[]
      >`
        select id, name, size, content_type, created_at from pipeline_job_artifacts
        where job_id = ${jobId} order by name`;
      return {
        items: rows.map((row) => ({
          id: row.id,
          name: row.name,
          size: Number(row.size),
          contentType: row.content_type,
          createdAt: iso(row.created_at),
        })),
      };
    },

    async read(
      ctx: RequestContext,
      jobId: string,
      name: string,
    ): Promise<{ contentType: string; body: Readable }> {
      await authorizePipelines(ctx);
      const [row] = await requireDatabase(deps)<{ object_key: string; content_type: string }[]>`
        select object_key, content_type from pipeline_job_artifacts
        where job_id = ${jobId} and name = ${name}`;
      if (!row) throw new NotFoundError('That job kept no file by that name');
      if (!deps.objects)
        throw new ProviderError('Artifacts need object storage, which is not set up');
      const object = await deps.objects.get(row.object_key);
      return { contentType: row.content_type, body: object.body };
    },
  };
}

export type ArtifactsService = ReturnType<typeof createArtifactsService>;
