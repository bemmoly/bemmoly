import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { isBemmolyError, NotFoundError } from '@bemmoly/shared';
import { moduleGate } from './module-gate.ts';

async function appWith(enabled: boolean, canAccess: boolean) {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    const status = error instanceof NotFoundError ? 404 : 403;
    return reply.code(status).send({ code: isBemmolyError(error) ? error.code : 'internal' });
  });
  app.addHook(
    'onRequest',
    moduleGate('pipelines', {
      isEnabled: () => enabled,
      access: { canAccess: async () => canAccess } as never,
      actorOf: async () => ({ kind: 'user', id: 'someone' }),
    }),
  );
  app.get('/closed', async () => ({ ok: true }));
  app.get('/runner', { config: { anonymous: true } }, async () => ({ ok: true }));
  await app.ready();
  return app;
}

describe('moduleGate', () => {
  it('lets an anonymous route through without a grant, since it checks its own token', async () => {
    const app = await appWith(true, false);
    expect((await app.inject('/runner')).statusCode).toBe(200);
    expect((await app.inject('/closed')).statusCode).toBe(403);
  });

  it('still answers 404 on an anonymous route while the module is disabled', async () => {
    const app = await appWith(false, true);
    const response = await app.inject('/runner');
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: 'module_not_enabled' });
  });
});
