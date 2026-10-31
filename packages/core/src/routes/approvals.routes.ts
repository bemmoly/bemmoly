import type { FastifyPluginAsync } from 'fastify';
import type { ApprovalsController } from '../controllers/approvals.controller.ts';

/**
 * The approval engine (ADR 0051): what waits on the caller across modules, one request, a
 * decision, a withdrawal, the caller's delegate, and the admins' workflow definitions. Saving
 * a definition always creates a new version. Requests are started in process by modules.
 */
export function approvalsRoutes(controller: ApprovalsController): FastifyPluginAsync {
  return async (app) => {
    app.get('/approval-requests', async (request) => controller.list(request));
    app.get('/approval-requests/:id', async (request) => controller.get(request));
    app.post('/approval-requests/:id/decisions', async (request, reply) =>
      controller.decide(request, reply),
    );
    app.post('/approval-requests/:id/withdraw', async (request) => controller.withdraw(request));
    app.get('/approval-delegations/me', async (request) => controller.delegation(request));
    app.put('/approval-delegations/me', async (request) => controller.setDelegation(request));
    app.delete('/approval-delegations/me', async (request, reply) =>
      controller.clearDelegation(request, reply),
    );
    app.get('/admin/approval-workflows', async (request) => controller.workflows(request));
    app.post('/admin/approval-workflows', async (request, reply) =>
      controller.saveWorkflow(request, reply),
    );
    app.get('/admin/approval-workflows/:id', async (request) => controller.workflow(request));
  };
}
