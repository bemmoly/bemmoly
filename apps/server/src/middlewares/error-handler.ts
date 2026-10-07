import { NotFoundError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { toHttpError } from './error-mapping.ts';

export async function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { status, body, headers } = toHttpError(error, request.id);
  if (status >= 500) {
    request.log.error({ err: error }, 'request failed');
  } else {
    request.log.info({ code: body.code, status }, 'request rejected');
  }
  return reply.code(status).headers(headers).send(body);
}

export async function apiNotFoundHandler(request: FastifyRequest): Promise<never> {
  throw new NotFoundError(`No route for ${request.method} ${request.url.split('?')[0] ?? ''}`);
}
