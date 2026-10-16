import { isBemmolyError, UnauthenticatedError, ValidationError } from '@bemmoly/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPipelinesControllers } from '../../controllers/index.ts';
import { runnerRoutes } from '../../routes/index.ts';
import { createPool } from '../../testing/execution.ts';
import { startPipelinesHarness, type PipelinesHarness } from '../../testing/harness.ts';

/* The runner protocol over HTTP: version header, status codes and token headers. */

describe('runner protocol over HTTP', () => {
  let harness: PipelinesHarness | undefined;
  let app: FastifyInstance;
  let reason = '';
  let poolToken = '';

  beforeAll(async () => {
    const started = await startPipelinesHarness();
    if (!started.available) {
      reason = started.reason;
      return;
    }
    harness = started.harness;
    poolToken = (await createPool(harness.sql, 'linux-x64')).token;
    app = Fastify();
    app.setErrorHandler((error, _request, reply) => {
      const status =
        error instanceof ValidationError ? 400 : error instanceof UnauthenticatedError ? 401 : 500;
      return reply
        .code(isBemmolyError(error) ? status : 500)
        .send({ message: (error as Error).message });
    });
    const controllers = createPipelinesControllers(harness.services);
    await app.register(runnerRoutes(controllers.runner), { prefix: '/api/v1/runner' });
    await app.ready();
  });

  afterAll(async () => {
    await app?.close();
    await harness?.services.wakeups.stop();
    await harness?.stop();
  });

  const post = (url: string, payload: unknown, headers: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/runner${url}`,
      payload: payload as object,
      headers: { 'x-bemmoly-runner-protocol': '1', ...headers },
    });

  it('registers with 201, answers an empty claim with 204, and refuses a stale version', async (ctx) => {
    if (!harness) return ctx.skip(reason);
    const old = await app.inject({
      method: 'POST',
      url: '/api/v1/runner/register',
      payload: { poolToken, name: 'x', version: '0.0.1' },
      headers: { 'x-bemmoly-runner-protocol': '0' },
    });
    expect(old.statusCode).toBe(400);
    expect(old.json().message).toContain('update bemmoly-runner');
    const registered = await post('/register', { poolToken, name: 'http', version: '0.1.0' });
    expect(registered.statusCode).toBe(201);
    const token = registered.json().runnerToken as string;
    const claim = await post('/claims', { waitSeconds: 0 }, { 'x-bemmoly-runner-token': token });
    expect(claim.statusCode).toBe(204);
    const beat = await post('/heartbeat', { state: 'idle' }, { 'x-bemmoly-runner-token': token });
    expect(beat.json()).toEqual({ cancel: false, drain: false });
    const stranger = await post(
      '/heartbeat',
      { state: 'idle' },
      { 'x-bemmoly-runner-token': 'bpr_nope' },
    );
    expect(stranger.statusCode).toBe(401);
  });
});
