import type { FastifyPluginAsync } from 'fastify';
import type { SettingsController } from '../controllers/settings.controller.ts';

export function adminSettingsRoutes(controller: SettingsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/admin/settings', async (request) => controller.list(request));
    app.get('/admin/settings/:key', async (request) => controller.get(request));
    app.put('/admin/settings/:key', async (request) => controller.put(request));
    app.delete('/admin/settings/:key', async (request, reply) => controller.reset(request, reply));
  };
}
