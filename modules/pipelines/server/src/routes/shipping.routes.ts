import type { FastifyPluginAsync } from 'fastify';
import type { ShippingController } from '../controllers/shipping.controller.ts';

/** Promotions, approvals and deployments under /api/v1/pipelines. */
export function shippingRoutes(controller: ShippingController): FastifyPluginAsync {
  return async (app) => {
    app.get('/promotions', async (request) => controller.listPromotions(request));
    app.get('/promotions/preview', async (request) => controller.previewPromotion(request));
    app.get('/promotions/:id', async (request) => controller.getPromotion(request));
    app.post('/promotions', async (request, reply) => controller.requestPromotion(request, reply));
    app.post('/promotions/:id/approvals', async (request, reply) =>
      controller.decide(request, reply),
    );
    app.post('/promotions/:id/cancel', async (request) => controller.cancel(request));
    app.post('/promotions/:id/freeze-override', async (request) =>
      controller.overrideFreeze(request),
    );
    app.get('/deployments', async (request) => controller.listDeployments(request));
    app.get('/deployments/:id', async (request) => controller.getDeployment(request));
    app.get('/deployments/:id/canary', async (request) => controller.canary(request));
    app.post('/deployments/:id/rollback', async (request) => controller.rollback(request));
    // A paused canary's decision: carry on with the plan, or roll back now.
    app.post('/deployments/:id/resume', async (request) => controller.resume(request));
  };
}
