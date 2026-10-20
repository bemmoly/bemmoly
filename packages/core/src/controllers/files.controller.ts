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

/*
 * How each kind of file may run when the browser opens it (ADR 0037). Images are drawn by
 * <img>, so their own document never needs to run anything. A PDF is framed by the page it
 * is in and drawn by the browser's viewer, which a sandbox would refuse. HTML runs its own
 * scripts in a sandbox without allow-same-origin, so it gets an origin of its own and can
 * reach neither the session nor the API; it may load libraries, styles, fonts and pictures
 * from the web, but connect-src and form-action shut every way of sending data back.
 */
const IMAGE_POLICY = "default-src 'none'; sandbox";
const PDF_POLICY = "default-src 'none'; frame-ancestors 'self'";
const HTML_POLICY = [
  'sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox',
  "default-src 'none'",
  "script-src https: 'unsafe-inline' 'unsafe-eval'",
  "style-src https: 'unsafe-inline'",
  'img-src https: data: blob:',
  'font-src https: data:',
  'media-src https: data: blob:',
  'worker-src blob:',
  "connect-src 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'self'",
].join('; ');

function servedAs(mime: string): { type: string; policy: string; framed: boolean } {
  if (mime === 'text/html')
    return { type: 'text/html; charset=utf-8', policy: HTML_POLICY, framed: true };
  if (mime === 'application/pdf') return { type: mime, policy: PDF_POLICY, framed: true };
  return { type: mime, policy: IMAGE_POLICY, framed: false };
}

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
     * Served as the sniffed type with no sniffing of its own, under the policy its kind runs
     * with; only HTML and PDF may be framed, and only by Bemmoly's own pages.
     */
    async read(request: FastifyRequest, reply: FastifyReply): Promise<Readable> {
      const { id } = parseOrThrow(fileIdParamsSchema, request.params);
      const file = await service.read(contextOf(request), id);
      const served = servedAs(file.mime);
      if (served.framed) reply.header('x-frame-options', 'SAMEORIGIN');
      reply
        .header('content-type', served.type)
        .header('content-length', String(file.size))
        .header('content-disposition', inline(file.name))
        .header('x-content-type-options', 'nosniff')
        .header('content-security-policy', served.policy)
        .header('cross-origin-resource-policy', 'same-origin')
        .header('cache-control', 'private, max-age=3600');
      return file.body;
    },
  };
}

export type FilesController = ReturnType<typeof createFilesController>;
