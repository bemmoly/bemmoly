import type { FastifyPluginAsync } from 'fastify';
import type { LibraryController } from '../controllers/library.controller.ts';

/** The Docs home lists, stars, labels and templates, under /api/v1/docs. */
export function libraryRoutes(controller: LibraryController): FastifyPluginAsync {
  return async (app) => {
    app.get('/home/recent', async (request) => controller.recent(request));
    app.get('/home/starred', async (request) => controller.starred(request));
    app.put('/pages/:pageId/star', async (request) => controller.star(request));
    app.delete('/pages/:pageId/star', async (request) => controller.unstar(request));
    app.put('/pages/:pageId/labels', async (request) => controller.setLabels(request));
    app.get('/labels', async (request) => controller.suggestLabels(request));
    app.get('/templates', async (request) => controller.listTemplates(request));
    app.post('/templates', async (request, reply) => controller.createTemplate(request, reply));
    app.get('/templates/:templateId', async (request) => controller.getTemplate(request));
    app.patch('/templates/:templateId', async (request) => controller.updateTemplate(request));
    app.delete('/templates/:templateId', async (request, reply) =>
      controller.removeTemplate(request, reply),
    );
    app.post('/templates/:templateId/pages', async (request, reply) =>
      controller.createFromTemplate(request, reply),
    );
  };
}
