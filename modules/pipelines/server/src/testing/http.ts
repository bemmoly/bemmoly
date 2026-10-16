import {
  ConflictError,
  ForbiddenError,
  isBemmolyError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from '@bemmoly/shared';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { createPipelinesControllers } from '../controllers/index.ts';
import { pipelinesRoutes } from '../routes/index.ts';
import type { PipelinesHarness } from './harness.ts';

/*
 * The Pipelines routes behind Fastify for endpoint tests, mounted as the server mounts them
 * under /api/v1/pipelines, with the person taken from an x-test-user header (the identity
 * middleware's job in the server) and typed errors mapped to their statuses.
 */

const STATUS: ReadonlyArray<[new (...args: never[]) => Error, number]> = [
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [ValidationError, 400],
  [ConflictError, 409],
  [UnauthenticatedError, 401],
];

export interface PipelinesHttp {
  app: FastifyInstance;
  get(path: string, as: string, query?: Record<string, string>): Promise<LightMyRequestResponse>;
  send(
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    as: string,
    body?: unknown,
  ): Promise<LightMyRequestResponse>;
}

export async function startPipelinesHttp(harness: PipelinesHarness): Promise<PipelinesHttp> {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const status = isBemmolyError(error)
      ? (STATUS.find(([type]) => error instanceof type)?.[1] ?? 500)
      : 500;
    const details = isBemmolyError(error) ? error.details : undefined;
    return reply.code(status).send({ message: (error as Error).message, details });
  });
  app.addHook('onRequest', async (request) => {
    const userId = request.headers['x-test-user'];
    if (typeof userId !== 'string') return;
    const ctx = harness.as(userId);
    request.actor = ctx.actor;
    request.authz = ctx.authz;
  });
  await app.register(pipelinesRoutes(createPipelinesControllers(harness.services)), {
    prefix: '/api/v1/pipelines',
  });
  await app.ready();
  return {
    app,
    get: (path, as, query = {}) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/pipelines${path}`,
        query,
        headers: { 'x-test-user': as },
      }),
    send: (method, path, as, body) =>
      app.inject({
        method,
        url: `/api/v1/pipelines${path}`,
        headers: { 'x-test-user': as },
        ...(body === undefined ? {} : { payload: body as object }),
      }),
  };
}
