import type { FastifyPluginAsync } from 'fastify';
import type { AuthzController } from '../controllers/authz.controller.ts';

export function authzRoutes(controller: AuthzController): FastifyPluginAsync {
  return async (app) => {
    app.get('/roles', async (req) => controller.listRoles(req));
    app.post('/roles', async (req, reply) => controller.createRole(req, reply));
    app.get('/roles/:id', async (req) => controller.getRole(req));
    app.patch('/roles/:id', async (req) => controller.updateRole(req));
    app.delete('/roles/:id', async (req, reply) => controller.deleteRole(req, reply));
    app.get('/roles/:id/capabilities', async (req) => controller.getRoleCapabilities(req));
    app.put('/roles/:id/capabilities', async (req) => controller.putRoleCapabilities(req));
    app.get('/capabilities', async (req) => controller.capabilityMatrix(req));

    app.get('/module-grants', async (req) => controller.listModuleGrants(req));
    app.post('/module-grants', async (req, reply) => controller.createModuleGrant(req, reply));
    app.get('/module-grants/:id', async (req) => controller.getModuleGrant(req));
    app.delete('/module-grants/:id', async (req, reply) =>
      controller.deleteModuleGrant(req, reply),
    );
  };
}
