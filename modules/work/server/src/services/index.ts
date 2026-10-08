import type { AuditRecorder, RealtimePublisher, SqlClient } from '@bemmoly/core';
import { createFieldsService } from './fields/index.ts';
import { createProjectsService } from './projects/index.ts';
import { createIssueTypesService } from './types/index.ts';

export interface WorkServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
}

/**
 * Every Work service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createWorkServices(deps: WorkServiceDeps) {
  return {
    projects: createProjectsService(deps),
    types: createIssueTypesService(deps),
    fields: createFieldsService(deps),
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
