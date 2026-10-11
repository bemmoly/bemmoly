import type { FastifyPluginAsync } from 'fastify';
import type { AiAnswersController } from '../controllers/ai-answers.controller.ts';

/** POST /api/v1/ai/answers: "Ask your docs" and ⌘K questions, streamed with citations. */
export function aiAnswersRoutes(controller: AiAnswersController): FastifyPluginAsync {
  return async (app) => {
    app.post('/ai/answers', async (request, reply) => controller.create(request, reply));
  };
}
