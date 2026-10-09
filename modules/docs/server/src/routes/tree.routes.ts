import type { FastifyPluginAsync } from 'fastify';
import type { TreeController } from '../controllers/tree.controller.ts';

/** The page tree, moves and the review flow, under /api/v1/docs. */
export function treeRoutes(controller: TreeController): FastifyPluginAsync {
  return async (app) => {
    app.get('/spaces/:spaceKey/tree', async (request) => controller.children(request));
    app.post('/pages/:pageId/move', async (request) => controller.move(request));
    app.put('/pages/:pageId/status', async (request) => controller.setStatus(request));
    app.put('/pages/:pageId/reviewers', async (request) => controller.setReviewers(request));
  };
}
