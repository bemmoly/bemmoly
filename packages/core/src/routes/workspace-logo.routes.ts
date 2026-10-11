import { LOGO_MAX_BYTES } from '@bemmoly/shared';
import type { FastifyPluginAsync } from 'fastify';
import type { WorkspaceLogoController } from '../controllers/workspace-logo.controller.ts';

/**
 * The body may run past the logo limit so the service, not the parser, says what was wrong
 * and by how much.
 */
const BODY_LIMIT = LOGO_MAX_BYTES * 2;

/**
 * POST /api/v1/workspace/logo takes the raw bytes of one PNG, SVG or WebP (the service reads
 * what they are) and DELETE removes it; both need workspace.appearance.manage, the upload
 * with the per-person upload budget (middlewares/rate-limit.ts). GET …/logo/:file serves it.
 */
export function workspaceLogoRoutes(controller: WorkspaceLogoController): FastifyPluginAsync {
  return async (app) => {
    app.removeAllContentTypeParsers();
    app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: BODY_LIMIT }, (_r, body, done) =>
      done(null, body),
    );
    app.post('/workspace/logo', { bodyLimit: BODY_LIMIT }, (request, reply) =>
      controller.upload(request, reply),
    );
    app.delete('/workspace/logo', (request, reply) => controller.remove(request, reply));
    // Anonymous by design: the sign-in page and emails show the logo before anyone signs in.
    app.get('/workspace/logo/:file', { config: { anonymous: true } }, (request, reply) =>
      controller.read(request, reply),
    );
  };
}
