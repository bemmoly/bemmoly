import type { JobRegistry, RealtimePublisher, SqlClient } from '@bemmoly/core';
import { createProjectsService } from './projects.ts';
import { createWorkflowService } from './workflow/index.ts';

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
  return {
    projects: createProjectsService(deps),
    workflow: createWorkflowService(deps),
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
