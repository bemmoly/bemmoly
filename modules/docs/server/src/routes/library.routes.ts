import type { FastifyPluginAsync } from 'fastify';
import type { LibraryController } from '../controllers/library.controller.ts';

/**
 * The Docs home lists, stars, labels and templates, under /api/v1/docs. The org-templates
 * routes are Settings › Docs: the org list with the archived ones, and their order.
 */
export function libraryRoutes(controller: LibraryController): FastifyPluginAsync {
  return async (app) => {
    app.get('/home/recent', async (request) => controller.recent(request));
    app.get('/home/starred', async (request) => controller.starred(request));
    app.get('/home/attention', async (request) => controller.attention(request));
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
    app.post('/templates/:templateId/archive', async (request) =>
      controller.archiveTemplate(request),
    );
    app.post('/templates/:templateId/restore', async (request) =>
      controller.restoreTemplate(request),
    );
    app.post('/templates/:templateId/duplicate', async (request, reply) =>
      controller.duplicateTemplate(request, reply),
    );
    app.get('/org-templates', async (request) => controller.listOrgTemplates(request));
    app.put('/org-templates/order', async (request, reply) =>
      controller.reorderOrgTemplates(request, reply),
    );
  };
}
