import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  pdfExportBodySchema,
  type DocsExportOptions,
  type PdfExport,
} from '../../../shared/pdf-export.ts';
import type { PdfExportService } from '../services/pdf-export/index.ts';
import { pageIdOf } from './pages.controller.ts';
import { disposition } from './transfer.controller.ts';

const exportIdSchema = z.object({ exportId: z.uuid() });

const exportIdOf = (request: FastifyRequest) =>
  parseOrThrow(exportIdSchema, request.params).exportId;

export function createPdfExportController(service: PdfExportService) {
  return {
    options: async (): Promise<DocsExportOptions> => ({ pdf: service.available() }),

    async create(request: FastifyRequest, reply: FastifyReply): Promise<PdfExport> {
      const body = parseOrThrow(pdfExportBodySchema, request.body ?? {});
      const key = request.headers['idempotency-key'];
      const created = await service.request(
        contextOf(request),
        pageIdOf(request),
        body,
        typeof key === 'string' && key.length <= 200 ? key : undefined,
      );
      reply.code(created.status === 'ready' ? 200 : 202);
      return created;
    },

    get: async (request: FastifyRequest): Promise<PdfExport> =>
      service.get(contextOf(request), exportIdOf(request)),

    async file(request: FastifyRequest, reply: FastifyReply): Promise<Buffer> {
      const file = await service.file(contextOf(request), exportIdOf(request));
      reply
        .header('content-type', 'application/pdf')
        .header('content-disposition', disposition(file.fileName))
        .header('cache-control', 'no-store');
      return file.body;
    },
  };
}

export type PdfExportController = ReturnType<typeof createPdfExportController>;
