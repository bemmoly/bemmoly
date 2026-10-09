import type { FastifyPluginAsync } from 'fastify';
import type { WorkflowController } from '../controllers/workflow.controller.ts';

/** Mounted at /api/v1/work behind the kernel's module gate. */
export function workflowRoutes(controller: WorkflowController): FastifyPluginAsync {
  return async (app) => {
    app.get('/workflows', async (request) => controller.list(request));
    app.post('/workflows', async (request, reply) => controller.create(request, reply));
    app.get('/workflows/:id', async (request) => controller.get(request));
    app.patch('/workflows/:id', async (request) => controller.update(request));
    app.get('/workflows/:id/statuses', async (request) => controller.statuses(request));
    app.get('/workflows/:id/status-counts', async (request) => controller.statusCounts(request));
    app.get('/workflows/:id/transitions', async (request) => controller.transitions(request));
    app.get('/workflows/:id/draft', async (request) => controller.getDraft(request));
    app.put('/workflows/:id/draft', async (request) => controller.putDraft(request));
    app.post('/workflows/:id/validate', async (request) => controller.validate(request));
    app.post('/workflows/:id/publish', async (request) => controller.publish(request));
    app.get('/issues/:key/transitions', async (request) => controller.issueTransitions(request));
    app.get('/workflow-rules', async (request) => controller.rules(request));
  };
}
