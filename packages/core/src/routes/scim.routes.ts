import type { FastifyPluginAsync } from 'fastify';
import { SCIM_CONTENT_TYPE, type ScimController } from '../controllers/scim.controller.ts';

/**
 * SCIM 2.0 at /scim/v2, outside the API prefix: identity providers authenticate with a SCIM
 * bearer token the controller checks, never with a session or a personal API token. Rate
 * limited per address (see the rate limiter's SCIM budget), and refused tokens count against
 * the address like any refused credential.
 */
export function scimRoutes(c: ScimController): FastifyPluginAsync {
  return async (app) => {
    app.addContentTypeParser(
      SCIM_CONTENT_TYPE,
      { parseAs: 'string' },
      app.getDefaultJsonParser('error', 'error'),
    );
    app.get('/Users', async (r, reply) => c.listUsers(r, reply));
    app.post('/Users', async (r, reply) => c.createUser(r, reply));
    app.get('/Users/:id', async (r, reply) => c.getUser(r, reply));
    app.put('/Users/:id', async (r, reply) => c.replaceUser(r, reply));
    app.patch('/Users/:id', async (r, reply) => c.patchUser(r, reply));
    app.delete('/Users/:id', async (r, reply) => c.deleteUser(r, reply));

    app.get('/Groups', async (r, reply) => c.listGroups(r, reply));
    app.post('/Groups', async (r, reply) => c.createGroup(r, reply));
    app.get('/Groups/:id', async (r, reply) => c.getGroup(r, reply));
    app.put('/Groups/:id', async (r, reply) => c.replaceGroup(r, reply));
    app.patch('/Groups/:id', async (r, reply) => c.patchGroup(r, reply));
    app.delete('/Groups/:id', async (r, reply) => c.deleteGroup(r, reply));
  };
}
