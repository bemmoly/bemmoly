import type { PipelinesServices } from '../services/index.ts';
import { createAccessController } from './access.controller.ts';
import { createCiController } from './ci.controller.ts';
import { createCatalogController } from './catalog.controller.ts';
import { createCatalogWritesController } from './catalog-writes.controller.ts';
import { createDeliveryController } from './delivery.controller.ts';
import { createDiscoveryController } from './discovery.controller.ts';
import { createCloudsController } from './clouds.controller.ts';
import { createOrganisationController } from './environments.controller.ts';
import { createInsightsController } from './insights.controller.ts';
import { createCapacityController } from './capacity.controller.ts';
import { createJobsController } from './jobs.controller.ts';
import { createRunnerController } from './runner.controller.ts';
import { createRunsController } from './runs.controller.ts';
import { createHistoryController } from './history.controller.ts';
import { createReleasesController } from './releases.controller.ts';
import { createShippingController } from './shipping.controller.ts';
import { createStreamsController } from './streams.controller.ts';
import { createViewsController } from './views.controller.ts';
import { createVariablesController } from './variables.controller.ts';
import { createRuntimesController } from './runtimes.controller.ts';
import { createFrontDoorsController } from './front-doors.controller.ts';
import { createExportsController } from './exports.controller.ts';

export function createPipelinesControllers(services: PipelinesServices) {
  return {
    access: createAccessController(services.access),
    ci: createCiController(services.ci),
    catalog: createCatalogController(services.catalog),
    catalogWrites: createCatalogWritesController(services.catalogWrites),
    delivery: createDeliveryController(services),
    views: createViewsController(services.views),
    discovery: createDiscoveryController(services.discovery),
    clouds: createCloudsController(services.clouds),
    organisation: createOrganisationController(services),
    history: createHistoryController(services.history),
    releases: createReleasesController(services.releases),
    shipping: createShippingController(services.shipping),
    streams: createStreamsController(services.streams),
    insights: createInsightsController(services.insights),
    runs: createRunsController(services.runs),
    jobs: createJobsController(services.logs, services.tests, services.artifacts),
    runner: createRunnerController(services.runner),
    capacity: createCapacityController(services.capacity),
    variables: createVariablesController(services.variables),
    runtimes: createRuntimesController(services.clusters, services.runtimes),
    frontDoors: createFrontDoorsController(services.frontDoors, services.moves),
    exports: createExportsController(services.exports),
  };
}

export type PipelinesControllers = ReturnType<typeof createPipelinesControllers>;
