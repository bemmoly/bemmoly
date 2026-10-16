import { decodeCursor, toPage, type RequestContext } from '@bemmoly/core';
import type {
  CatalogChangesPage,
  ListCatalogChangesQuery,
} from '../../../../shared/catalog-writes.ts';
import type { CatalogChangeRow } from '../../models/catalog-writes.ts';
import { createCatalogService } from '../catalog/index.ts';
import { noPullRequests, type PullRequestOpener } from '../code/pull-requests.ts';
import { noRepositoryReader, type RepositoryReader } from '../code/repository-reader.ts';
import { requireAccess, requireDatabase, type PipelinesServiceDeps } from '../deps.ts';
import { createApplicationWrites } from './applications.ts';
import { publishCatalog } from './lookups.ts';
import { CHANGE_FROM, CHANGE_SELECT, toCatalogChange } from './repo-change.ts';
import { createStructureWrites } from './structure.ts';
import {
  syncApplicationFiles,
  type ApplicationFilesInput,
  type ApplicationFilesResult,
} from './sync.ts';

/*
 * The catalog's write side: domains, groups and applications from the UI, and
 * application.yaml from repositories. Code host access comes in through two ports, so
 * nothing here knows which forge it talks to.
 */

export interface CatalogWritesDeps extends PipelinesServiceDeps {
  pullRequests?: PullRequestOpener;
  repositories?: RepositoryReader;
}

export type { ApplicationFilesInput, ApplicationFilesResult } from './sync.ts';
export { readApplicationFile, writeApplicationFile } from './file.ts';
export { teamSlug } from './owners.ts';

export function createCatalogWritesService(deps: CatalogWritesDeps) {
  const sql = () => requireDatabase(deps);
  const access = requireAccess(deps);
  const ports = {
    pullRequests: deps.pullRequests ?? noPullRequests,
    repositories: deps.repositories ?? noRepositoryReader,
  };
  const applications = createApplicationWrites(sql, access, createCatalogService(deps), ports);
  return {
    ...createStructureWrites(sql, access),
    applications,
    ports,

    /**
     * The application.yaml files a push to the default branch changed; content null when the
     * push deleted the file. Called by the push processor under a system context.
     */
    async applyApplicationFiles(
      ctx: RequestContext,
      input: ApplicationFilesInput,
    ): Promise<ApplicationFilesResult> {
      await access.authorizeAction(ctx, 'platform', {});
      return sql().begin(async (tx) => {
        const { domains, ...result } = await syncApplicationFiles(tx, input);
        const keys = [...result.applied, ...result.archived];
        if (keys.length > 0)
          await publishCatalog(tx, keys, domains.length === 1 ? domains[0] : undefined);
        return result;
      });
    },

    async changes(
      ctx: RequestContext,
      query: ListCatalogChangesQuery,
    ): Promise<CatalogChangesPage> {
      await access.authorizeAction(ctx, 'view', {});
      const db = sql();
      const after = decodeCursor(query.cursor);
      const rows = await db<CatalogChangeRow[]>`
        select ${db.unsafe(CHANGE_SELECT)} from ${db.unsafe(CHANGE_FROM)}
        where true
          ${query.application ? db`and a.key = ${query.application}` : db``}
          ${query.state ? db`and c.state = ${query.state}` : db``}
          ${after ? db`and (c.created_at, c.id) < (select created_at, id from pipeline_catalog_changes where id = ${after}::uuid)` : db``}
        order by c.created_at desc, c.id desc
        limit ${query.limit + 1}`;
      const page = toPage(rows, query.limit);
      return { items: page.rows.map(toCatalogChange), nextCursor: page.nextCursor };
    },
  };
}

export type CatalogWritesService = ReturnType<typeof createCatalogWritesService>;
