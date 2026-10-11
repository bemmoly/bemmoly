import type { FastifyPluginAsync } from 'fastify';
import type { PdfExportController } from '../controllers/pdf-export.controller.ts';

/** PDF exports through the optional renderer: whether it runs, queue one, read it, download it. */
export function pdfExportRoutes(controller: PdfExportController): FastifyPluginAsync {
  return async (app) => {
    app.get('/exports/options', async () => controller.options());
    app.post('/pages/:pageId/exports', async (request, reply) => controller.create(request, reply));
    app.get('/exports/:exportId', async (request) => controller.get(request));
    app.get('/exports/:exportId/file', async (request, reply) => controller.file(request, reply));
  };
}
