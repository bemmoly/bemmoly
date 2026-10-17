import type { RequestContext, SqlClient } from '@bemmoly/core';
import type { CompareQuery, ListReleasesQuery } from '../../../../shared/releases.ts';
import { authorizePipelines, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { compareReleases } from './compare.ts';
import { getRelease, listReleases } from './read.ts';
import { createReleaseWriter } from './write.ts';

export {
  createReleaseWriter,
  type CreatedRelease,
  type CreateReleaseInput,
  type ReleaseWriter,
} from './write.ts';

/*
 * Releases (architecture §11): created once by a passing build or by Bring your CI through
 * the writer, and read by the release page, the application page and the Promote screen.
 */
export function createReleasesService(deps: PipelinesServiceDeps) {
  const sql = (): SqlClient => requireDatabase(deps);
  return {
    writer: createReleaseWriter(),

    async list(ctx: RequestContext, query: ListReleasesQuery) {
      await authorizePipelines(ctx);
      return listReleases(sql(), query);
    },

    async get(ctx: RequestContext, id: string) {
      await authorizePipelines(ctx);
      return getRelease(sql(), id);
    },

    async compare(ctx: RequestContext, query: CompareQuery) {
      await authorizePipelines(ctx);
      return compareReleases(sql(), query);
    },
  };
}

export type ReleasesService = ReturnType<typeof createReleasesService>;
