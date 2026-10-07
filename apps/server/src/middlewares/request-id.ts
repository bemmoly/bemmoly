import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { LogController, type FastifyReply, type FastifyRequest } from 'fastify';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Accept an upstream id (Caddy, a load balancer) only when it is short and plain. */
const ACCEPTED_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function generateRequestId(request: IncomingMessage): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return typeof incoming === 'string' && ACCEPTED_ID.test(incoming) ? incoming : randomUUID();
}

/** Fastify server options: every log line carries `requestId`. */
export function requestIdOptions() {
  return {
    genReqId: generateRequestId,
    requestIdHeader: false,
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
  } as const;
}

export async function exposeRequestId(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  reply.header(REQUEST_ID_HEADER, request.id);
}
