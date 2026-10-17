import type { FastifyPluginAsync } from 'fastify';
import type { AccessController } from '../controllers/access.controller.ts';

/** Role bindings, policies and the access checker under /api/v1/pipelines. */
export function accessRoutes(controller: AccessController): FastifyPluginAsync {
  return async (app) => {
    app.get('/bindings', async (request) => controller.bindings(request));
    app.post('/bindings', async (request, reply) => controller.createBinding(request, reply));
    app.delete('/bindings/:id', async (request, reply) => controller.removeBinding(request, reply));
    app.get('/policies', async (request) => controller.policies(request));
    app.post('/policies', async (request, reply) => controller.createPolicy(request, reply));
    app.patch('/policies/:id', async (request) => controller.updatePolicy(request));
    app.get('/policies/:id/versions', async (request) => controller.policyVersions(request));
    // A second Platform admin's approval of a waiting Tier 0 change.
    app.post('/policies/:id/versions/:version/approvals', async (request, reply) =>
      controller.approvePolicyVersion(request, reply),
    );
    app.get('/access/decisions', async (request) => controller.decisions(request));
    app.post('/access/checks', async (request) => controller.check(request));
  };
}
