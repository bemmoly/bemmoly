import type { FastifyPluginAsync } from 'fastify';
import { IMPORT_MAX_BYTES } from '../../../shared/transfer.ts';
import type { TransferController } from '../controllers/transfer.controller.ts';

/** Room for the largest import's text once JSON-escaped. */
const IMPORT_BODY_LIMIT = IMPORT_MAX_BYTES * 2;

/** Exports of a page or its subtree, and imports into a space. */
export function transferRoutes(controller: TransferController): FastifyPluginAsync {
  return async (app) => {
    app.get('/pages/:pageId/export', async (request, reply) =>
      controller.exportPage(request, reply),
    );
    app.post(
      '/spaces/:spaceKey/imports',
      { bodyLimit: IMPORT_BODY_LIMIT },
      async (request, reply) => controller.importPages(request, reply),
    );
  };
}
