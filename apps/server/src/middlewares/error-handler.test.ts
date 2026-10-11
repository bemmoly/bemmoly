import { defineModule } from '@bemmoly/core';
import { Writable } from 'node:stream';
import {
  ConflictError,
  ForbiddenError,
  MaintenanceError,
  NotFoundError,
  ProviderError,
  RateLimitedError,
  ValidationError,
  apiErrorBodySchema,
} from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from '../app.ts';
import { modulesOf, TEST_ENV } from '../test-support.ts';
import { INTERNAL_ERROR_MESSAGE } from './error-mapping.ts';

const failures: Record<string, () => unknown> = {
  'not-found': () => new NotFoundError('No such issue'),
  forbidden: () => new ForbiddenError('No access', { code: 'module_access_denied' }),
  invalid: () => new ValidationError('Bad input', { details: { field: 'title' } }),
  conflict: () => new ConflictError('Changed since you loaded it'),
  limited: () => new RateLimitedError('Slow down', { retryAfterSeconds: 12 }),
  provider: () => new ProviderError('SMTP relay timed out', { provider: 'smtp' }),
  maintenance: () => new MaintenanceError('Restoring a backup', { retryAfterSeconds: 30 }),
  zod: () => z.object({ title: z.string() }).parse({}),
  crash: () => new Error('database password is hunter2'),
};

const thrower = defineModule({
  id: 'thrower',
  version: '0.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'none',
  changelog: [],
  register(ctx) {
    ctx.routes.add({
      prefix: '/failures',
      plugin: async (app) => {
        app.get<{ Params: { kind: string } }>('/:kind', async (request) => {
          throw failures[request.params.kind]?.() ?? new Error('unknown');
        });
      },
    });
  },
});

describe('error handler', () => {
  it.each([
    ['not-found', 404, 'not_found'],
    ['forbidden', 403, 'module_access_denied'],
    ['invalid', 400, 'validation_failed'],
    ['conflict', 409, 'conflict'],
    ['limited', 429, 'rate_limited'],
    ['provider', 502, 'provider_error'],
    ['maintenance', 503, 'maintenance'],
    ['zod', 400, 'validation_failed'],
    ['crash', 500, 'internal_error'],
  ])('maps %s to %i %s with the shared body', async (kind, status, code) => {
    const app = await buildApp({ env: TEST_ENV, modules: modulesOf(thrower), logger: false });
    const response = await app.inject({ url: `/api/v1/failures/${kind}` });
    expect(response.statusCode).toBe(status);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body.code).toBe(code);
    expect(body.requestId).toBe(response.headers['x-request-id']);
  });

  it('adds Retry-After, keeps details and hides internal messages', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: modulesOf(thrower), logger: false });
    const limited = await app.inject({ url: '/api/v1/failures/limited' });
    expect(limited.headers['retry-after']).toBe('12');
    const invalid = await app.inject({ url: '/api/v1/failures/invalid' });
    expect(invalid.json()).toMatchObject({ details: { field: 'title' } });
    const crash = await app.inject({ url: '/api/v1/failures/crash' });
    expect(crash.json()).toMatchObject({ message: INTERNAL_ERROR_MESSAGE });
    expect(crash.body).not.toContain('hunter2');
  });

  it('logs maintenance refusals as warnings and crashes as errors', async () => {
    const lines: { level: number; msg: string; requestId?: string }[] = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(JSON.parse(chunk.toString()) as (typeof lines)[number]);
        done();
      },
    });
    const app = await buildApp({ env: TEST_ENV, modules: modulesOf(thrower), logger: { stream } });
    const levelOf = async (kind: string) => {
      const response = await app.inject({ url: `/api/v1/failures/${kind}` });
      const requestId = response.headers['x-request-id'];
      return lines.find((line) => line.requestId === requestId && line.msg !== 'request completed')
        ?.level;
    };
    expect(await levelOf('maintenance')).toBe(40);
    expect(await levelOf('crash')).toBe(50);
  });

  it('maps malformed JSON bodies to bad_request', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: modulesOf(thrower), logger: false });
    app.post('/api/v1/json-bodies', async () => ({ parsed: true }));
    const post = (payload: string) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/json-bodies',
        headers: { 'content-type': 'application/json' },
        payload,
      });
    expect((await post('{"title":"ok"}')).json()).toEqual({ parsed: true });
    const response = await post('{not json');
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'bad_request' });
  });
});
