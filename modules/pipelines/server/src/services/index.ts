import type { SettingsRegistry, SqlClient } from '@bemmoly/core';
import { createCatalogService } from './catalog/index.ts';
import { createEnvironmentsService } from './environments/index.ts';
import { createOverviewService } from './overview/index.ts';
import { createStreamsService } from './streams/index.ts';
import { createTeamsService } from './teams/index.ts';

export interface PipelinesServicesDeps {
  database?: SqlClient;
  /** Pipelines' own settings (job timeouts, retention), read by the services that apply them. */
  settings?: Pick<SettingsRegistry, 'get'>;
}

/**
 * Every Pipelines service, built once at boot. Each area adds its factory here and nowhere
 * else, so module.ts never grows with the product.
 */
export function createPipelinesServices(deps: PipelinesServicesDeps) {
  return {
    catalog: createCatalogService(deps),
    environments: createEnvironmentsService(deps),
    teams: createTeamsService(deps),
    overview: createOverviewService(deps),
    streams: createStreamsService(deps),
  };
}

export type PipelinesServices = ReturnType<typeof createPipelinesServices>;
