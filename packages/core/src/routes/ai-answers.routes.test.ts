import { aiAnswerEventSchema, isBemmolyError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { loadModules } from '../modules/loader.ts';
import { createRetrievalService, createTestAi, type TestAi } from '../services/ai/index.ts';
import type { RequestAuthorization } from '../services/authz/index.ts';
import { kernelRoutes } from './index.ts';

const STATUS: Record<string, number> = {
  ValidationError: 400,
  ForbiddenError: 403,
  UnauthenticatedError: 401,
};

async function build(ai: TestAi, signedIn = true): Promise<FastifyInstance> {
  const app = Fastify();
  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    const status = isBemmolyError(error) ? (STATUS[error.name] ?? 500) : (error.statusCode ?? 500);
    void reply.code(status).send({
      code: isBemmolyError(error) ? error.code : 'internal_error',
      details: isBemmolyError(error) ? error.details : undefined,
    });
  });
  app.addHook('onRequest', async (request) => {
    if (!signedIn) return;
    request.actor = { kind: 'user', id: 'u1' };
    request.authz = { modulesFor: async () => new Set() } as unknown as RequestAuthorization;
  });
  const retrieval = createRetrievalService({
    sql: undefined as never,
    ai: () => ai,
    sources: () => [],
    keyword: () => [],
    isEnabled: () => true,
  });
  await app.register(kernelRoutes({ modules: loadModules({ available: [] }), retrieval }));
  return app;
}

describe('POST /api/v1/ai/answers', () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it('answers 401 without a signed-in person and 400 without a question', async () => {
    app = await build(createTestAi(), false);
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/ai/answers', payload: { question: 'x' } }))
        .statusCode,
    ).toBe(401);
    await app.close();
    app = await build(createTestAi());
    expect(
      (await app.inject({ method: 'POST', url: '/api/v1/ai/answers', payload: { question: ' ' } }))
        .statusCode,
    ).toBe(400);
  });

  it('refuses with the reason before streaming when AI is off', async () => {
    app = await build(createTestAi({ policy: { enabled: false } }));
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/answers',
      payload: { question: 'How do we roll back?' },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ details: { reason: 'ai_off' } });
  });

  it('streams NDJSON events, here the honest empty answer', async () => {
    app = await build(createTestAi());
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/ai/answers',
      payload: { question: 'How do we roll back?' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/x-ndjson');
    const events = response.body
      .trim()
      .split('\n')
      .map((line) => aiAnswerEventSchema.parse(JSON.parse(line)));
    expect(events).toEqual([
      { type: 'sources', sources: [] },
      { type: 'done', outcome: 'no_sources', runId: null, text: '', cited: [] },
    ]);
  });
});
