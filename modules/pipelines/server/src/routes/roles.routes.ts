import type { FastifyPluginAsync } from 'fastify';
import type { RolesController } from '../controllers/roles.controller.ts';

/** The person's role, People and roles, and approval groups under /api/v1/pipelines. */
export function rolesRoutes(controller: RolesController): FastifyPluginAsync {
  return async (app) => {
    app.get('/me', async (request) => controller.me(request));
    app.get('/people', async (request) => controller.people(request));
    app.post('/people/invitations', async (request, reply) => controller.invite(request, reply));
    app.delete('/people/invitations/:id', async (request, reply) =>
      controller.revokeInvitation(request, reply),
    );
    app.put('/people/:userId', async (request) => controller.setRole(request));
    app.delete('/people/:userId', async (request, reply) =>
      controller.removePerson(request, reply),
    );
    app.get('/approval-groups', async (request) => controller.groups(request));
    app.post('/approval-groups', async (request, reply) => controller.createGroup(request, reply));
    app.patch('/approval-groups/:id', async (request) => controller.updateGroup(request));
    app.delete('/approval-groups/:id', async (request, reply) =>
      controller.removeGroup(request, reply),
    );
    app.post('/approval-groups/:id/members', async (request, reply) =>
      controller.addMembers(request, reply),
    );
    app.delete('/approval-groups/:id/members/:userId', async (request, reply) =>
      controller.removeMember(request, reply),
    );
  };
}
