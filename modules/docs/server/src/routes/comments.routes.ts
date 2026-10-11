import type { FastifyPluginAsync } from 'fastify';
import type { CommentsController } from '../controllers/comments.controller.ts';

/** Page comments: listed and started under the page, changed by their own id. */
export function commentsRoutes(controller: CommentsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/pages/:pageId/comments', async (request) => controller.list(request));
    app.post('/pages/:pageId/comments', async (request, reply) =>
      controller.create(request, reply),
    );
    app.patch('/comments/:commentId', async (request) => controller.update(request));
    app.delete('/comments/:commentId', async (request, reply) => controller.remove(request, reply));
    app.post('/comments/:commentId/resolve', async (request) => controller.resolve(request));
    app.post('/comments/:commentId/reopen', async (request) => controller.reopen(request));
    app.post('/comments/:commentId/apply-suggestion', async (request) =>
      controller.applySuggestion(request),
    );
  };
}
