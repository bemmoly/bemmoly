import { MaintenanceError, NotFoundError } from '@bemmoly/shared';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { toHttpError } from './error-mapping.ts';

export async function errorHandler(
  error: unknown,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<FastifyReply> {
  const { status, body, headers } = toHttpError(error, request.id);
  // A 503 during a restore or an update is the maintenance page doing its job.
  if (error instanceof MaintenanceError) {
    request.log.warn({ code: body.code, status }, 'request refused during maintenance');
  } else if (status >= 500) {
    request.log.error({ err: error }, 'request failed');
  } else {
    request.log.info({ code: body.code, status }, 'request rejected');
  }
  if (request.url.startsWith('/scim/')) {
    return reply
      .code(status)
      .headers(headers)
      .type('application/scim+json')
      .send(scimErrorBody(status, body));
  }
  return reply.code(status).headers(headers).send(body);
}

/** RFC 7644 §3.12: identity providers read SCIM errors in their own shape. */
function scimErrorBody(status: number, body: { message: string; details?: unknown }) {
  const scimType = (body.details as { scimType?: unknown } | undefined)?.scimType;
  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
    status: String(status),
    detail: body.message,
    ...(typeof scimType === 'string' ? { scimType } : {}),
  };
}

export async function apiNotFoundHandler(request: FastifyRequest): Promise<never> {
  throw new NotFoundError(`No route for ${request.method} ${request.url.split('?')[0] ?? ''}`);
}
