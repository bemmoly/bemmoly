import type { FastifyPluginAsync } from 'fastify';
import type { PipelinesControllers } from '../controllers/index.ts';
import { accessRoutes } from './access.routes.ts';
import { ciRoutes } from './ci.routes.ts';
import { catalogRoutes } from './catalog.routes.ts';
import { catalogWritesRoutes } from './catalog-writes.routes.ts';
import { discoveryRoutes } from './discovery.routes.ts';
import { insightsRoutes } from './insights.routes.ts';
import { cloudsRoutes } from './clouds.routes.ts';
import { organisationRoutes } from './organisation.routes.ts';
import { capacityRoutes } from './capacity.routes.ts';
import { jobsRoutes } from './jobs.routes.ts';
import { runsRoutes } from './runs.routes.ts';
import { releasesRoutes } from './releases.routes.ts';
import { shippingRoutes } from './shipping.routes.ts';
import { streamsRoutes } from './streams.routes.ts';

export { runnerRoutes } from './runner.routes.ts';

/**
 * Everything under /api/v1/pipelines, one plugin per area so each area's routes file stays
 * its own and this list is the only shared line to add.
 */
export function pipelinesRoutes(controllers: PipelinesControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(accessRoutes(controllers.access));
    await app.register(ciRoutes(controllers.ci));
    await app.register(catalogRoutes(controllers.catalog));
    await app.register(catalogWritesRoutes(controllers.catalogWrites));
    await app.register(discoveryRoutes(controllers.discovery));
    await app.register(cloudsRoutes(controllers.clouds));
    await app.register(organisationRoutes(controllers.organisation));
    await app.register(releasesRoutes(controllers.releases));
    await app.register(shippingRoutes(controllers.shipping));
    await app.register(streamsRoutes(controllers.streams));
    await app.register(insightsRoutes(controllers.insights));
    await app.register(runsRoutes(controllers.runs));
    await app.register(jobsRoutes(controllers.jobs));
    await app.register(capacityRoutes(controllers.capacity));
  };
}
