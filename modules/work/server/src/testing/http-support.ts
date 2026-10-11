import { ForbiddenError, isBemmolyError, NotFoundError, ValidationError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import { createWorkControllers } from '../controllers/index.ts';
import { workRoutes } from '../routes/index.ts';
import type { WorkHarness } from '../services/int-support.ts';

/*
 * The Work routes behind Fastify for endpoint tests: routes, controllers and services as the
 * server mounts them under /api/v1/work, with the person taken from an x-test-user header
 * (the identity middleware's job in the server) and typed errors mapped to their statuses.
 */

const STATUS: ReadonlyArray<[new (...args: never[]) => Error, number]> = [
  [NotFoundError, 404],
  [ForbiddenError, 403],
  [ValidationError, 400],
];

export interface WorkHttp {
  app: FastifyInstance;
  get(path: string, as: string, query?: Record<string, string>): Promise<LightMyRequestResponse>;
}

export async function startWorkHttp(harness: WorkHarness): Promise<WorkHttp> {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const status = isBemmolyError(error)
      ? (STATUS.find(([type]) => error instanceof type)?.[1] ?? 500)
      : 500;
    return reply.code(status).send({ message: (error as Error).message });
  });
  app.addHook('onRequest', async (request) => {
    const userId = request.headers['x-test-user'];
    if (typeof userId !== 'string') return;
    const ctx = harness.as(userId);
    request.actor = ctx.actor;
    request.authz = ctx.authz;
  });
  await app.register(workRoutes(createWorkControllers(harness.services)), {
    prefix: '/api/v1/work',
  });
  await app.ready();
  return {
    app,
    get: (path, as, query = {}) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/work${path}`,
        query,
        headers: { 'x-test-user': as },
      }),
  };
}
