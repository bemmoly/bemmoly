import type { FastifyPluginAsync } from 'fastify';
import type { PipelinesControllers } from '../controllers/index.ts';
import { catalogRoutes } from './catalog.routes.ts';
import { organisationRoutes } from './organisation.routes.ts';
import { streamsRoutes } from './streams.routes.ts';

/**
 * Everything under /api/v1/pipelines, one plugin per area so each area's routes file stays
 * its own and this list is the only shared line to add.
 */
export function pipelinesRoutes(controllers: PipelinesControllers): FastifyPluginAsync {
  return async (app) => {
    await app.register(catalogRoutes(controllers.catalog));
    await app.register(organisationRoutes(controllers.organisation));
    await app.register(streamsRoutes(controllers.streams));
  };
}
