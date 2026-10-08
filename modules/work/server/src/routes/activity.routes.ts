import type { FastifyPluginAsync } from 'fastify';
import type { ActivityController } from '../controllers/activity.controller.ts';

/** Comments, links, history and search under /api/v1/work. */
export function activityRoutes(controller: ActivityController): FastifyPluginAsync {
  return async (app) => {
    app.get('/issues/:key/comments', async (request) => controller.listComments(request));
    app.post('/issues/:key/comments', async (request, reply) =>
      controller.createComment(request, reply),
    );
    app.patch('/comments/:id', async (request) => controller.updateComment(request));
    app.delete('/comments/:id', async (request, reply) => controller.removeComment(request, reply));
    app.put('/comments/:id/reactions', async (request) => controller.react(request));
    app.get('/issues/:key/links', async (request) => controller.listLinks(request));
    app.post('/issues/:key/links', async (request, reply) => controller.createLink(request, reply));
    app.delete('/links/:id', async (request, reply) => controller.removeLink(request, reply));
    app.get('/issues/:key/history', async (request) => controller.history(request));
    app.get('/search', async (request) => controller.search(request));
    app.get('/search/suggest', async (request) => controller.suggest(request));
  };
}
