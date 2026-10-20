import type { FastifyPluginAsync } from 'fastify';
import type { FilesController } from '../controllers/files.controller.ts';

/**
 * POST /api/v1/files?target=&targetId=&name= takes the raw bytes of one image, whatever
 * Content-Type the browser picked (the service reads what they are); GET /api/v1/files/:id
 * serves it to people who may read its target. Both authenticated, the upload with a
 * per-person budget of its own (middlewares/rate-limit.ts).
 *
 * PUT /api/v1/upload-links/:token takes the bytes an agent sends to a link an MCP tool handed
 * out. It is anonymous by design: the single-use token in the path is the credential, checked
 * by the service, which then uploads as the link's person (ADR 0048). It shares the upload
 * budget, per address.
 */
export function filesRoutes(controller: FilesController, maxBytes: number): FastifyPluginAsync {
  return async (app) => {
    app.removeAllContentTypeParsers();
    app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: maxBytes }, (_r, body, done) =>
      done(null, body),
    );
    app.post('/files', { bodyLimit: maxBytes }, (request, reply) =>
      controller.upload(request, reply),
    );
    app.get('/files/:id', (request, reply) => controller.read(request, reply));
    app.put(
      '/upload-links/:token',
      { bodyLimit: maxBytes, config: { anonymous: true } },
      (request, reply) => controller.uploadByLink(request, reply),
    );
  };
}
