import type { SettingsRegistry, SqlClient } from '@bemmoly/core';
import { createAccessService } from './access/index.ts';
import { createCatalogService } from './catalog/index.ts';
import { createCatalogWritesService } from './catalog-writes/index.ts';
import type { PullRequestOpener } from './code/pull-requests.ts';
import type { RepositoryReader } from './code/repository-reader.ts';
import { createEnvironmentsService } from './environments/index.ts';
import { createOverviewService } from './overview/index.ts';
import { createStreamsService } from './streams/index.ts';
import { createTeamsService } from './teams/index.ts';

export interface PipelinesServicesDeps {
  database?: SqlClient;
  /** Pipelines' own settings (job timeouts, retention), read by the services that apply them. */
  settings?: Pick<SettingsRegistry, 'get'>;
  /** The code host's ports for catalog pull requests and repository reads; absent, edits wait. */
  pullRequests?: PullRequestOpener;
  repositories?: RepositoryReader;
}

/**
 * Every Pipelines service, built once at boot. Each area adds its factory here and nowhere
 * else, so module.ts never grows with the product.
 */
export function createPipelinesServices(input: PipelinesServicesDeps) {
  const access = createAccessService(input);
  const deps = { ...input, access };
  return {
    access,
    catalog: createCatalogService(deps),
    catalogWrites: createCatalogWritesService(deps),
    environments: createEnvironmentsService(deps),
    teams: createTeamsService(deps),
    overview: createOverviewService(deps),
    streams: createStreamsService(deps),
  };
}

export type PipelinesServices = ReturnType<typeof createPipelinesServices>;
