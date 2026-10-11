import type { FastifyPluginAsync } from 'fastify';
import type { CodeLinksController } from '../controllers/code-links.controller.ts';

/** Mounted under /api/v1/work behind the kernel's module gate. */
export function codeLinksRoutes(controller: CodeLinksController): FastifyPluginAsync {
  return async (app) => {
    app.get('/issues/:key/code-links', async (request) => controller.list(request));
    app.get('/projects/:key/code-transitions', async (request) => controller.transitions(request));
    app.put('/projects/:key/code-transitions', async (request) =>
      controller.updateTransitions(request),
    );
  };
}
