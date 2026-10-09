import type {
  AuditRecorder,
  EventBus,
  JobRegistry,
  RealtimePublisher,
  SqlClient,
} from '@bemmoly/core';
import { createBacklogService } from './backlog/index.ts';
import { createBoardsService } from './boards/index.ts';
import { createCommentsService } from './comments/index.ts';
import { createComponentsService } from './components/index.ts';
import { createFieldsService } from './fields/index.ts';
import { createFiltersService } from './filters/index.ts';
import { createHistoryService } from './history/index.ts';
import { createIssuesService } from './issues/index.ts';
import { createLabelsService } from './labels/index.ts';
import { createLinksService } from './links/index.ts';
import { createLqlService } from './lql/index.ts';
import { createMetricsService } from './metrics/index.ts';
import { createMyWorkService } from './my-work/index.ts';
import { createProjectsService } from './projects/index.ts';
import { createSearchService } from './search/index.ts';
import { createSprintsService } from './sprints/index.ts';
import { createIssueTypesService } from './types/index.ts';
import { createVersionsService } from './versions/index.ts';
import { createWorkflowService } from './workflow/index.ts';

export interface WorkServiceDeps {
  database?: SqlClient;
  audit?: AuditRecorder;
  realtime?: RealtimePublisher;
  events?: EventBus;
  jobs?: JobRegistry;
}

const noRealtime: RealtimePublisher = { publish: async () => undefined };
const noEvents: EventBus = { publish: async () => undefined, subscribe: () => () => undefined };

/**
 * Every Work service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createWorkServices(deps: WorkServiceDeps) {
  const lql = createLqlService(deps);
  const workflow = createWorkflowService({ ...deps, lql });
  const issueDeps = {
    ...(deps.database ? { database: deps.database } : {}),
    realtime: deps.realtime ?? noRealtime,
    events: deps.events ?? noEvents,
    ...(deps.jobs ? { jobs: deps.jobs } : {}),
    workflow: workflow.gate,
  };
  return {
    projects: createProjectsService(deps),
    types: createIssueTypesService(deps),
    fields: createFieldsService(deps),
    labels: createLabelsService(deps),
    versions: createVersionsService(deps),
    components: createComponentsService(deps),
    issues: createIssuesService(issueDeps),
    comments: createCommentsService(issueDeps),
    links: createLinksService(issueDeps),
    history: createHistoryService(issueDeps),
    search: createSearchService(issueDeps),
    myWork: createMyWorkService(issueDeps),
    workflow,
    lql,
    boards: createBoardsService({ ...deps, ...issueDeps, lql }),
    sprints: createSprintsService({ ...deps, ...issueDeps, lql }),
    backlog: createBacklogService({ ...deps, ...issueDeps, lql }),
    filters: createFiltersService({ ...deps, ...issueDeps, lql }),
    metrics: createMetricsService({ ...deps, ...issueDeps, lql }),
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
