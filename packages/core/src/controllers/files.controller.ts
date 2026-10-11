import type { Readable } from 'node:stream';
import {
  fileIdParamsSchema,
  parseOrThrow,
  uploadFileQuerySchema,
  ValidationError,
  type UploadedFile,
} from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { FilesService } from '../services/files/index.ts';
import { contextOf } from './request-context.ts';

/** An inline header any browser reads: an ASCII fallback and the UTF-8 name. */
const inline = (name: string) =>
  `inline; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; ` +
  `filename*=UTF-8''${encodeURIComponent(name)}`;

export function createFilesController(service: FilesService) {
  return {
    async upload(request: FastifyRequest, reply: FastifyReply): Promise<UploadedFile> {
      const query = parseOrThrow(uploadFileQuerySchema, request.query);
      if (!Buffer.isBuffer(request.body)) throw new ValidationError('Send the file as the body');
      const file = await service.upload(contextOf(request), query, request.body);
      reply.code(201);
      return file;
    },

    /**
     * Served so the browser can only ever draw it as an image: the sniffed type, no sniffing
     * of its own, and a sandboxing policy should it be opened as a page.
     */
    async read(request: FastifyRequest, reply: FastifyReply): Promise<Readable> {
      const { id } = parseOrThrow(fileIdParamsSchema, request.params);
      const file = await service.read(contextOf(request), id);
      reply
        .header('content-type', file.mime)
        .header('content-length', String(file.size))
        .header('content-disposition', inline(file.name))
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', "default-src 'none'; sandbox")
        .header('cross-origin-resource-policy', 'same-origin')
        .header('cache-control', 'private, max-age=3600');
      return file.body;
    },
  };
}

export type FilesController = ReturnType<typeof createFilesController>;
