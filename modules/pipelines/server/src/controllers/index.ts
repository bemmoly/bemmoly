import type { PipelinesServices } from '../services/index.ts';
import { createAccessController } from './access.controller.ts';
import { createCiController } from './ci.controller.ts';
import { createCatalogController } from './catalog.controller.ts';
import { createCatalogWritesController } from './catalog-writes.controller.ts';
import { createDiscoveryController } from './discovery.controller.ts';
import { createCloudsController } from './clouds.controller.ts';
import { createOrganisationController } from './environments.controller.ts';
import { createInsightsController } from './insights.controller.ts';
import { createCapacityController } from './capacity.controller.ts';
import { createJobsController } from './jobs.controller.ts';
import { createRunnerController } from './runner.controller.ts';
import { createRunsController } from './runs.controller.ts';
import { createReleasesController } from './releases.controller.ts';
import { createShippingController } from './shipping.controller.ts';
import { createStreamsController } from './streams.controller.ts';

export function createPipelinesControllers(services: PipelinesServices) {
  return {
    access: createAccessController(services.access),
    ci: createCiController(services.ci),
    catalog: createCatalogController(services.catalog),
    catalogWrites: createCatalogWritesController(services.catalogWrites),
    discovery: createDiscoveryController(services.discovery),
    clouds: createCloudsController(services.clouds),
    organisation: createOrganisationController(services),
    releases: createReleasesController(services.releases),
    shipping: createShippingController(services.shipping),
    streams: createStreamsController(services.streams),
    insights: createInsightsController(services.insights),
    runs: createRunsController(services.runs),
    jobs: createJobsController(services.logs, services.tests, services.artifacts),
    runner: createRunnerController(services.runner),
    capacity: createCapacityController(services.capacity),
  };
}

export type PipelinesControllers = ReturnType<typeof createPipelinesControllers>;
