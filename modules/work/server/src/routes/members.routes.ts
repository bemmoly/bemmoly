import type { FastifyPluginAsync } from 'fastify';
import type { MembersController } from '../controllers/members.controller.ts';

/** The people of a project, which the URL names by key or id. */
export function membersRoutes(controller: MembersController): FastifyPluginAsync {
  return async (app) => {
    app.get('/projects/:key/members', async (request) => controller.list(request));
    app.post('/projects/:key/members', async (request, reply) => controller.add(request, reply));
    app.patch('/projects/:key/members/:userId', async (request) => controller.update(request));
    app.delete('/projects/:key/members/:userId', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
