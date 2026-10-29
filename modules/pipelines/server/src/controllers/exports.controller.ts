import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { exportQuerySchema } from '../../../shared/exports.ts';
import type { ExportsService } from '../services/exports/index.ts';

/** An attachment header any browser reads: an ASCII fallback and the UTF-8 name. */
const disposition = (fileName: string) =>
  `attachment; filename="${fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; ` +
  `filename*=UTF-8''${encodeURIComponent(fileName)}`;

/** Platform › Export: the bundle's preview, and the bundle itself as a zip. */
export function createExportsController(exports: ExportsService) {
  const queryOf = (request: FastifyRequest) => parseOrThrow(exportQuerySchema, request.query);
  return {
    preview: (request: FastifyRequest) => exports.preview(contextOf(request), queryOf(request)),
    async archive(request: FastifyRequest, reply: FastifyReply): Promise<Buffer> {
      const file = await exports.archive(contextOf(request), queryOf(request));
      reply
        .header('content-type', 'application/zip')
        .header('content-disposition', disposition(file.fileName))
        .header('cache-control', 'no-store');
      return file.body;
    },
  };
}

export type ExportsController = ReturnType<typeof createExportsController>;
