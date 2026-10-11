import { parseOrThrow } from '@bemmoly/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ItemsService } from './items.ts';

const createItemBody = z.object({ label: z.string().trim().min(1).max(200) });
/** Same key twice within a day enqueues one job. */
const createPingBody = z.object({ idempotencyKey: z.string().min(1).max(128).optional() });

/** Mounted at /api/v1/fixture behind the kernel's module gate. */
export function fixtureRoutes(service: ItemsService): FastifyPluginAsync {
  return async (app) => {
    app.get('/items', async () => ({ items: await service.list() }));
    app.post('/items', async (request, reply) => {
      const { label } = parseOrThrow(createItemBody, request.body);
      reply.code(201);
      return service.create(label);
    });
    app.post('/pings', async (request, reply) => {
      const { idempotencyKey } = parseOrThrow(createPingBody, request.body ?? {});
      reply.code(202);
      return service.ping(idempotencyKey);
    });
    app.get('/greeting', async () => ({ greeting: await service.greeting() }));
  };
}
