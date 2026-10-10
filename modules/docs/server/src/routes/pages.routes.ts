import type { FastifyPluginAsync } from 'fastify';
import type { PagesController } from '../controllers/pages.controller.ts';

/** Mounted at /api/v1/docs/pages behind the kernel's module gate. */
export function pagesRoutes(controller: PagesController): FastifyPluginAsync {
  return async (app) => {
    app.post('/pages', async (request, reply) => controller.create(request, reply));
    app.get('/pages/:pageId', async (request) => controller.get(request));
    app.patch('/pages/:pageId', async (request) => controller.update(request));
    app.delete('/pages/:pageId', async (request, reply) => controller.remove(request, reply));
    app.post('/pages/:pageId/restore', async (request) => controller.restore(request));
    app.get('/spaces/:spaceKey/trash', async (request) => controller.trash(request));
    app.delete('/spaces/:spaceKey/trash', async (request) => controller.emptyTrash(request));
    app.delete('/spaces/:spaceKey/trash/:pageId', async (request, reply) =>
      controller.deleteForever(request, reply),
    );
  };
}
