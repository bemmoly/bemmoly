import type { FastifyPluginAsync } from 'fastify';
import type { AppearanceController } from '../controllers/appearance.controller.ts';

/** A person's own appearance and the custom themes they can pick, under /api/v1. */
export function appearanceRoutes(c: AppearanceController): FastifyPluginAsync {
  return async (app) => {
    app.get('/me/appearance', async (req) => c.preference(req));
    app.put('/me/appearance', async (req) => c.setPreference(req));
    app.get('/themes', async (req) => c.list(req));
    app.post('/themes', async (req, reply) => c.create(req, reply));
    app.patch('/themes/:id', async (req) => c.update(req));
    app.delete('/themes/:id', async (req, reply) => c.remove(req, reply));
  };
}
