import type { EventBus, JobRegistry, RealtimePublisher, SqlClient } from '@bemmoly/core';
import { createCommentsService } from './comments/index.ts';
import { createHistoryService } from './history/index.ts';
import { createIssuesService } from './issues/index.ts';
import { createLinksService } from './links/index.ts';
import { createProjectsService } from './projects.ts';
import { createSearchService } from './search/index.ts';
import { openTransitionGate, type TransitionGate } from './workflow/contract.ts';

export interface WorkServiceDeps {
  database?: SqlClient;
  realtime?: RealtimePublisher;
  events?: EventBus;
  jobs?: JobRegistry;
  /** The workflow service once it is wired; any status is reachable until then. */
  workflow?: TransitionGate;
}

const noRealtime: RealtimePublisher = { publish: async () => undefined };
const noEvents: EventBus = { publish: async () => undefined, subscribe: () => () => undefined };

/**
 * Every Work service, built once at boot. Each area adds its factory here and
 * nowhere else, so module.ts never grows with the module.
 */
export function createWorkServices(deps: WorkServiceDeps) {
  const issueDeps = {
    ...(deps.database ? { database: deps.database } : {}),
    realtime: deps.realtime ?? noRealtime,
    events: deps.events ?? noEvents,
    ...(deps.jobs ? { jobs: deps.jobs } : {}),
    workflow: deps.workflow ?? openTransitionGate,
  };
  return {
    projects: createProjectsService(deps),
    issues: createIssuesService(issueDeps),
    comments: createCommentsService(issueDeps),
    links: createLinksService(issueDeps),
    history: createHistoryService(issueDeps),
    search: createSearchService(issueDeps),
  };
}

export type WorkServices = ReturnType<typeof createWorkServices>;
