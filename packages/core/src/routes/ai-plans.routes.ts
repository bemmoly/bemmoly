import type { FastifyPluginAsync } from 'fastify';
import type { AiPlansController } from '../controllers/ai-plans.controller.ts';

/**
 * The ⌘K palette's plans under /api/v1/ai/plans: draw one up, read it, run the allowed steps,
 * cancel, and undo what ran. Each is the signed-in person's own; nobody else's plan is found.
 */
export function aiPlansRoutes(controller: AiPlansController): FastifyPluginAsync {
  return async (app) => {
    app.post('/ai/plans', async (request, reply) => controller.create(request, reply));
    app.get('/ai/plans/:id', async (request) => controller.get(request));
    app.post('/ai/plans/:id/run', async (request) => controller.run(request));
    app.post('/ai/plans/:id/cancel', async (request) => controller.cancel(request));
    app.post('/ai/plans/:id/undo', async (request) => controller.undo(request));
  };
}
