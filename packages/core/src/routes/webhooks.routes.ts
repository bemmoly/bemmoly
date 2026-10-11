import type { FastifyPluginAsync } from 'fastify';
import type { WebhooksController } from '../controllers/webhooks.controller.ts';

/**
 * Settings › Webhooks under /api/v1/admin: endpoints, a new signing secret, the delivery log
 * and new deliveries (a test send or a redelivery). /webhook-targets lists names only, for
 * the automation rule builder of people who are not admins.
 */
export function webhooksRoutes(controller: WebhooksController): FastifyPluginAsync {
  return async (app) => {
    app.get('/webhook-targets', async (request) => controller.targets(request));
    app.get('/admin/webhook-catalog', async (request) => controller.catalog(request));
    app.get('/admin/webhooks', async (request) => controller.list(request));
    app.post('/admin/webhooks', async (request, reply) => controller.create(request, reply));
    app.get('/admin/webhooks/:id', async (request) => controller.get(request));
    app.patch('/admin/webhooks/:id', async (request) => controller.update(request));
    app.delete('/admin/webhooks/:id', async (request, reply) => controller.remove(request, reply));
    app.post('/admin/webhooks/:id/secrets', async (request, reply) =>
      controller.rotateSecret(request, reply),
    );
    app.get('/admin/webhooks/:id/deliveries', async (request) => controller.deliveries(request));
    app.post('/admin/webhooks/:id/deliveries', async (request, reply) =>
      controller.deliver(request, reply),
    );
  };
}
