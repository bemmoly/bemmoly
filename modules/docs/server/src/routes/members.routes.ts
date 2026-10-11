import type { FastifyPluginAsync } from 'fastify';
import type { MembersController } from '../controllers/members.controller.ts';

/** Mounted at /api/v1/docs/spaces/:spaceKey/members behind the kernel's module gate. */
export function membersRoutes(controller: MembersController): FastifyPluginAsync {
  return async (app) => {
    app.get('/spaces/:spaceKey/members', async (request) => controller.list(request));
    app.post('/spaces/:spaceKey/members', async (request, reply) => controller.add(request, reply));
    app.put('/spaces/:spaceKey/members/:userId', async (request) => controller.put(request));
    app.delete('/spaces/:spaceKey/members/:userId', async (request, reply) =>
      controller.remove(request, reply),
    );
  };
}
