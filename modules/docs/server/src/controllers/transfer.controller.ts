import { contextOf } from '@bemmoly/core';
import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  exportQuerySchema,
  importBodySchema,
  type ImportResult,
} from '../../../shared/transfer.ts';
import type { TransferService } from '../services/transfer/index.ts';
import { pageIdOf } from './pages.controller.ts';
import { spaceRefOf } from './spaces.controller.ts';

/** An attachment header any browser reads: an ASCII fallback and the UTF-8 name. */
const disposition = (fileName: string) =>
  `attachment; filename="${fileName.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; ` +
  `filename*=UTF-8''${encodeURIComponent(fileName)}`;

export function createTransferController(service: TransferService) {
  return {
    async exportPage(request: FastifyRequest, reply: FastifyReply): Promise<Buffer | string> {
      const query = parseOrThrow(exportQuerySchema, request.query);
      const file = await service.exportPage(contextOf(request), pageIdOf(request), query);
      reply
        .header('content-type', file.contentType)
        .header('content-disposition', disposition(file.fileName))
        .header('cache-control', 'no-store');
      return file.body;
    },
    async importPages(request: FastifyRequest, reply: FastifyReply): Promise<ImportResult> {
      const body = parseOrThrow(importBodySchema, request.body);
      const key = request.headers['idempotency-key'];
      const result = await service.importPages(
        contextOf(request),
        spaceRefOf(request),
        body,
        typeof key === 'string' && key.length <= 200 ? key : undefined,
      );
      reply.code(result.status === 'completed' ? 201 : 202);
      return result;
    },
  };
}

export type TransferController = ReturnType<typeof createTransferController>;
