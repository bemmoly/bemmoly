import type { FastifyPluginAsync } from 'fastify';
import type { NotificationsController } from '../controllers/notifications.controller.ts';

export function notificationsRoutes(controller: NotificationsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/notifications', async (request) => controller.list(request));
    app.post('/notifications/read-all', async (request) => controller.readAll(request));
    app.patch('/notifications/:id', async (request) => controller.mark(request));
    app.get('/notification-preferences', async (request) => controller.preferences(request));
    app.put('/notification-preferences', async (request) => controller.updatePreferences(request));
  };
}
