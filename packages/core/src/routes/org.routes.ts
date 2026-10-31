import type { FastifyPluginAsync } from 'fastify';
import type { OrgController } from '../controllers/org.controller.ts';

/**
 * The person record and org data under /api/v1 (ADR 0050). People are addressed by their
 * user id; /users stays the account, /people the employment record.
 */
export function orgRoutes(controller: OrgController): FastifyPluginAsync {
  return async (app) => {
    app.get('/people', async (request) => controller.list(request));
    app.post('/people', async (request, reply) => controller.create(request, reply));
    app.get('/people/:userId', async (request) => controller.get(request));
    app.patch('/people/:userId', async (request) => controller.update(request));
    app.get('/people/:userId/managers', async (request) => controller.managers(request));
    app.get('/people/:userId/reports', async (request) => controller.reports(request));

    app.get('/locations', async (request) => controller.listLocations(request));
    app.post('/locations', async (request, reply) => controller.createLocation(request, reply));
    app.get('/locations/:id', async (request) => controller.getLocation(request));
    app.patch('/locations/:id', async (request) => controller.updateLocation(request));
    app.delete('/locations/:id', async (request, reply) =>
      controller.removeLocation(request, reply),
    );

    app.get('/cost-centres', async (request) => controller.listCostCentres(request));
    app.post('/cost-centres', async (request, reply) =>
      controller.createCostCentre(request, reply),
    );
    app.get('/cost-centres/:id', async (request) => controller.getCostCentre(request));
    app.patch('/cost-centres/:id', async (request) => controller.updateCostCentre(request));
    app.delete('/cost-centres/:id', async (request, reply) =>
      controller.removeCostCentre(request, reply),
    );
  };
}
