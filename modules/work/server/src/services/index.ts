import type { JobRegistry, RealtimePublisher, SqlClient } from '@bemmoly/core';
import { createLqlService } from './lql/index.ts';
import { createProjectsService } from './projects.ts';

export interface WorkServiceDeps {
  database?: SqlClient;
  realtime?: RealtimePublisher;
  jobs?: JobRegistry;
}

/**
 * Every Work service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createWorkServices(deps: WorkServiceDeps) {
  const lql = createLqlService(deps);
  return {
    projects: createProjectsService(deps),
    lql,
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
