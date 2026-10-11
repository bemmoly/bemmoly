import type { FastifyReply } from 'fastify';

/**
 * A signal that aborts when the client goes away before the reply is finished. It listens on
 * the response, never the request: Node closes a request as soon as its body has been read,
 * so a request's "close" would stop the work before the first byte is sent.
 */
export function abortOnClose(reply: FastifyReply): AbortSignal {
  const controller = new AbortController();
  reply.raw.once('close', () => {
    if (!reply.raw.writableFinished) controller.abort();
  });
  return controller.signal;
}
