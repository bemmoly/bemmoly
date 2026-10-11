import type { Readable } from 'node:stream';
import {
  logoFileParamsSchema,
  parseOrThrow,
  ValidationError,
  type WorkspaceLogo,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  readWorkspaceLogo,
  removeWorkspaceLogo,
  uploadWorkspaceLogo,
  type WorkspaceLogoDeps,
} from '../services/appearance/index.ts';
import { contextOf } from './request-context.ts';

/** /workspace/logo: the workspace's own logo in the sidebar, the sign-in page and emails. */
export function createWorkspaceLogoController(deps: WorkspaceLogoDeps) {
  return {
    async upload(request: FastifyRequest, reply: FastifyReply): Promise<WorkspaceLogo> {
      if (!Buffer.isBuffer(request.body)) throw new ValidationError('Send the logo as the body');
      const logo = await uploadWorkspaceLogo(deps, contextOf(request), request.body);
      reply.code(201);
      return logo;
    },

    async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      await removeWorkspaceLogo(deps, contextOf(request));
      reply.code(204);
    },

    /**
     * Content addressed, so cached for good and revalidated by its hash. Served so the
     * browser only ever draws it as an image, even an SVG opened directly.
     */
    async read(request: FastifyRequest, reply: FastifyReply): Promise<Readable | undefined> {
      const params = parseOrThrow(logoFileParamsSchema, request.params);
      const logo = await readWorkspaceLogo(deps, params);
      const etag = `"${logo.etag}"`;
      reply
        .header('etag', etag)
        .header('cache-control', 'public, max-age=31536000, immutable')
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        .header('cross-origin-resource-policy', 'same-origin');
      if (request.headers['if-none-match'] === etag) {
        logo.body.destroy();
        reply.code(304);
        return undefined;
      }
      reply.header('content-type', logo.mime).header('content-length', String(logo.size));
      return logo.body;
    },
  };
}

export type WorkspaceLogoController = ReturnType<typeof createWorkspaceLogoController>;
