import type { PipelinesServices } from '../services/index.ts';
import { createAccessController } from './access.controller.ts';
import { createCatalogController } from './catalog.controller.ts';
import { createCatalogWritesController } from './catalog-writes.controller.ts';
import { createOrganisationController } from './environments.controller.ts';
import { createInsightsController } from './insights.controller.ts';
import { createJobsController } from './jobs.controller.ts';
import { createRunnerController } from './runner.controller.ts';
import { createRunsController } from './runs.controller.ts';
import { createStreamsController } from './streams.controller.ts';

export function createPipelinesControllers(services: PipelinesServices) {
  return {
    access: createAccessController(services.access),
    catalog: createCatalogController(services.catalog),
    catalogWrites: createCatalogWritesController(services.catalogWrites),
    organisation: createOrganisationController(services),
    streams: createStreamsController(services.streams),
    insights: createInsightsController(services.insights),
    runs: createRunsController(services.runs),
    jobs: createJobsController(services.logs, services.tests, services.artifacts),
    runner: createRunnerController(services.runner),
  };
}

export type PipelinesControllers = ReturnType<typeof createPipelinesControllers>;
