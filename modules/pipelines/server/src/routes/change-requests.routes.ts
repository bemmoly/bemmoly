import type { FastifyPluginAsync } from 'fastify';
import type { ChangeRequestsController } from '../controllers/change-requests.controller.ts';

/** Change requests under /api/v1/pipelines/change-requests, named by number (CHG-1042). */
export function changeRequestsRoutes(controller: ChangeRequestsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/change-requests', async (request) => controller.list(request));
    app.get('/change-requests/options', async (request) => controller.options(request));
    app.post('/change-requests', async (request, reply) => controller.create(request, reply));
    app.get('/change-requests/:number', async (request) => controller.get(request));
    app.patch('/change-requests/:number', async (request) => controller.update(request));
    app.post('/change-requests/:number/send', async (request) => controller.send(request));
    app.post('/change-requests/:number/approve', async (request) => controller.approve(request));
    app.post('/change-requests/:number/reject', async (request) => controller.reject(request));
    app.post('/change-requests/:number/withdraw', async (request) => controller.withdraw(request));
  };
}
