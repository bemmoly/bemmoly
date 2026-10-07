import { defineModule } from '@bemmoly/core';
import {
  ConflictError,
  ForbiddenError,
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

  it('maps malformed JSON bodies to bad_request', async () => {
    const app = await buildApp({ env: TEST_ENV, modules: modulesOf(thrower), logger: false });
    app.post('/api/v1/echo', async (request) => request.body);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'bad_request' });
  });
});
