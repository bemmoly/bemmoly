import type { CodeHostDirectory, SendJobOptions, SettingsRegistry, SqlClient } from '@bemmoly/core';
import { createAccessService } from './access/index.ts';
import { createCatalogService } from './catalog/index.ts';
import { createCatalogWritesService } from './catalog-writes/index.ts';
import { codeHostPullRequests, codeHostRepositories } from './code/adapters.ts';
import { createPipelinesCodeHosts } from './code/hosts.ts';
import type { PullRequestOpener } from './code/pull-requests.ts';
import type { RepositoryReader } from './code/repository-reader.ts';
import { createEnvironmentsService } from './environments/index.ts';
import { registerCatalogSync } from './inbox/catalog-sync.ts';
import { createInboxService } from './inbox/index.ts';
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
  /** The kernel's connected code hosts (ADR 0045); the ports above default to them. */
  codeHosts?: CodeHostDirectory;
  /** Enqueues the module's own background jobs. */
  sendJob?: (
    name: string,
    payload: Record<string, unknown>,
    options?: SendJobOptions,
  ) => Promise<unknown>;
}

/**
 * Every Pipelines service, built once at boot. Each area adds its factory here and nowhere
 * else, so module.ts never grows with the product.
 */
export function createPipelinesServices(input: PipelinesServicesDeps) {
  const access = createAccessService(input);
  const code = input.codeHosts ? createPipelinesCodeHosts(input.codeHosts) : undefined;
  const deps = {
    ...input,
    access,
    ...(code
      ? {
          code,
          pullRequests: input.pullRequests ?? codeHostPullRequests(code),
          repositories: input.repositories ?? codeHostRepositories(code),
        }
      : {}),
  };
  const catalogWrites = createCatalogWritesService(deps);
  const inbox = createInboxService(deps);
  if (code) registerCatalogSync(inbox.handlers, code, catalogWrites);
  return {
    access,
    inbox,
    catalog: createCatalogService(deps),
    catalogWrites,
    environments: createEnvironmentsService(deps),
    teams: createTeamsService(deps),
    overview: createOverviewService(deps),
    streams: createStreamsService(deps),
  };
}

export type PipelinesServices = ReturnType<typeof createPipelinesServices>;
