import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from '@bemmoly/shared';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { createDocsControllers } from '../controllers/index.ts';
import { docsRoutes } from '../routes/index.ts';
import type { DocsServices } from '../services/index.ts';
import type { DocsHarness } from '../services/int-support.ts';

/*
 * The Docs routes behind Fastify for endpoint tests: routes, controllers and services exactly
 * as the server mounts them under /api/v1/docs, with the person taken from an x-test-user
 * header (the identity middleware's job in the server) and typed errors mapped to the statuses
 * the server's error handler gives them.
 */

const STATUS: ReadonlyArray<[new (...args: never[]) => Error, number]> = [
  [UnauthenticatedError, 401],
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [ValidationError, 400],
  [ConflictError, 409],
];

export interface DocsHttp {
  app: FastifyInstance;
  /** One request as the person; `as: null` sends it signed out. */
  call(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options: { as: string | null; body?: unknown },
  ): Promise<LightMyRequestResponse>;
}

export async function startDocsHttp(
  harness: DocsHarness,
  services: DocsServices = harness.services,
): Promise<DocsHttp> {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const status = isBemmolyError(error)
      ? (STATUS.find(([type]) => error instanceof type)?.[1] ?? 500)
      : ((error as { statusCode?: number }).statusCode ?? 500);
    return reply.code(status).send({
      code: isBemmolyError(error) ? error.code : 'internal',
      message: (error as Error).message,
    });
  });
  app.addHook('onRequest', async (request) => {
    const userId = request.headers['x-test-user'];
    if (typeof userId !== 'string') return;
    const ctx = harness.as(userId);
    request.actor = ctx.actor;
    request.authz = ctx.authz;
  });
  await app.register(docsRoutes(createDocsControllers(services)), { prefix: '/api/v1/docs' });
  await app.ready();
  return {
    app,
    call: (method, url, options) =>
      app.inject({
        method,
        url: `/api/v1/docs${url}`,
        headers: options.as ? { 'x-test-user': options.as } : {},
        ...(options.body !== undefined ? { payload: options.body as object } : {}),
      }),
  };
}
