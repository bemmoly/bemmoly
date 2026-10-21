import type {
  ActorContextFactory,
  AuditRecorder,
  ContainerMemberships,
  EventBus,
  JobRegistry,
  LinkRegistry,
  RealtimePublisher,
  SqlClient,
  SettingsRegistry,
} from '@bemmoly/core';
import { createAutomationService } from './automation/index.ts';
import { createBacklogService } from './backlog/index.ts';
import { createBoardsService } from './boards/index.ts';
import { createCodeLinksService } from './code-links/index.ts';
import { createCommentsService } from './comments/index.ts';
import { createDashboardsService } from './dashboards/index.ts';
import { createComponentsService } from './components/index.ts';
import { createFieldsService } from './fields/index.ts';
import { createFiltersService } from './filters/index.ts';
import { createHistoryService } from './history/index.ts';
import { requireDatabase } from './issues/deps.ts';
import { createIssueImportService } from './import/mcp/index.ts';
import { createInitiativesService } from './initiatives/index.ts';
import { createIssuesService } from './issues/index.ts';
import { notify } from './issues/notify.ts';
import { createLabelsService } from './labels/index.ts';
import { createLinksService } from './links/index.ts';
import { createLqlService } from './lql/index.ts';
import { createMetricsService } from './metrics/index.ts';
import { createPairingService } from './pairing/index.ts';
import { createReportsService } from './reports/index.ts';
import { createTimeTrackingService } from './reports/time-tracking-service.ts';
import { createQuarterService } from './reports/quarter-service.ts';
import { createStatsService } from './reports/stats-service.ts';
import { createMyWorkService } from './my-work/index.ts';
import { createProjectsService } from './projects/index.ts';
import { createProjectMembersService } from './projects/members.ts';
import { createRoadmapService } from './roadmap/index.ts';
import { createSchemesService } from './schemes/index.ts';
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
  memberships?: ContainerMemberships;
  links?: Pick<LinkRegistry, 'referencesToMany'>;
  /** Builds the automation actor's context for a run; present with a database. */
  contextFor?: ActorContextFactory;
  /** Work's own settings, for the features they switch on. */
  settings?: Pick<SettingsRegistry, 'get'>;
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
  const issues = createIssuesService(issueDeps);
  const comments = createCommentsService(issueDeps);
  const labels = createLabelsService(deps);
  const automation = createAutomationService({
    ...(deps.database ? { database: deps.database } : {}),
    ...(deps.audit ? { audit: deps.audit } : {}),
    ...(deps.jobs ? { jobs: deps.jobs } : {}),
    ...(deps.contextFor ? { contextFor: deps.contextFor } : {}),
    events: issueDeps.events,
    lql,
    services: {
      issues,
      comments,
      labels,
      workflow,
      events: issueDeps.events,
      notify: (ctx, issue, notice) =>
        notify(issueDeps, ctx, requireDatabase(issueDeps), issue, notice),
    },
  });
  return {
    projects: createProjectsService(deps),
    members: createProjectMembersService(deps),
    schemes: createSchemesService(deps),
    types: createIssueTypesService(deps),
    fields: createFieldsService(deps),
    labels,
    versions: createVersionsService(deps),
    components: createComponentsService(deps),
    issues,
    issueImport: createIssueImportService(deps),
    codeLinks: createCodeLinksService({
      ...(deps.database ? { database: deps.database } : {}),
      ...(deps.audit ? { audit: deps.audit } : {}),
      realtime: issueDeps.realtime,
      move: (ctx, key, statusId) => issues.update(ctx, key, { statusId }),
    }),
    comments,
    links: createLinksService(issueDeps),
    history: createHistoryService(issueDeps),
    search: createSearchService(issueDeps),
    myWork: createMyWorkService(issueDeps),
    automation,
    workflow,
    lql,
    boards: createBoardsService({ ...deps, ...issueDeps, lql }),
    sprints: createSprintsService({ ...deps, ...issueDeps, lql }),
    backlog: createBacklogService({ ...deps, ...issueDeps, lql }),
    filters: createFiltersService({ ...deps, ...issueDeps, lql }),
    metrics: createMetricsService({ ...deps, ...issueDeps, lql }),
    roadmap: createRoadmapService({ ...deps, ...issueDeps, lql }),
    initiatives: createInitiativesService(deps),
    pairing: createPairingService({ ...deps, ...issueDeps }),
    reports: createReportsService({ ...deps, ...issueDeps }),
    timeTracking: createTimeTrackingService({ ...deps, ...issueDeps }),
    stats: createStatsService(deps),
    quarter: createQuarterService({ ...deps, ...issueDeps }),
    dashboards: createDashboardsService(deps),
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
