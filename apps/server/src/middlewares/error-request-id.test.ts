import { Writable } from 'node:stream';
import { defineModule } from '@bemmoly/core';
import { createMetrics } from '@bemmoly/core/telemetry';
import { apiErrorBodySchema, NotFoundError, REQUEST_ID_HEADER } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.ts';
import { modulesOf, TEST_ENV } from '../test-support.ts';

/** Everything a handler might throw, including values that are not errors at all. */
const thrown: Record<string, () => unknown> = {
  'typed-error': () => new NotFoundError('No such page'),
  'plain-error': () => new Error('boom'),
  'string-value': () => 'a bare string',
  'null-value': () => null,
  'undefined-value': () => undefined,
  'number-value': () => 42,
  'object-without-message': () => ({ reason: 'opaque' }),
  'status-401': () => Object.assign(new Error('no session'), { statusCode: 401 }),
  'status-418': () => Object.assign(new Error('teapot'), { statusCode: 418 }),
  'status-503': () => Object.assign(new Error('draining'), { statusCode: 503 }),
};

const thrower = defineModule({
  id: 'thrower',
  version: '0.0.0',
  coreApi: '^0.1.0',
  defaultAccess: 'none',
  changelog: [],
  register(ctx) {
    ctx.routes.add({
      prefix: '/throw',
      plugin: async (app) => {
        app.get<{ Params: { kind: string } }>('/:kind', async (request) => {
          throw thrown[request.params.kind]?.();
        });
        app.post('/json', async (request) => request.body);
      },
    });
  },
});

async function build(stream?: NodeJS.WritableStream) {
  return buildApp({
    env: TEST_ENV,
    modules: modulesOf(thrower),
    metrics: createMetrics(),
    logger: stream ? { stream } : false,
  });
}

function expectReference(response: { headers: Record<string, unknown>; json(): unknown }) {
  const body = apiErrorBodySchema.parse(response.json());
  expect(body.requestId.length).toBeGreaterThan(0);
  expect(body.requestId).toBe(response.headers[REQUEST_ID_HEADER]);
  return body;
}

describe('error surface: every error response carries the request id', () => {
  it.each(Object.keys(thrown))('when a handler throws %s', async (kind) => {
    const app = await build();
    const response = await app.inject({ url: `/api/v1/throw/${kind}` });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expectReference(response);
  });

  it.each([
    ['an unknown route', { url: '/api/v1/nowhere' }],
    ['an unknown method', { method: 'DELETE' as const, url: '/api/v1/modules' }],
    [
      'malformed JSON',
      {
        method: 'POST' as const,
        url: '/api/v1/throw/json',
        headers: { 'content-type': 'application/json' },
        payload: '{oops',
      },
    ],
    [
      'an unsupported media type',
      {
        method: 'POST' as const,
        url: '/api/v1/throw/json',
        headers: { 'content-type': 'application/x-unknown' },
        payload: 'x',
      },
    ],
  ])('for %s', async (_case, request) => {
    const app = await build();
    const response = await app.inject(request);
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expectReference(response);
  });

  it('keeps an upstream request id and logs unexpected failures under it', async () => {
    const lines: Array<Record<string, unknown>> = [];
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
        done();
      },
    });
    const app = await build(stream);
    const response = await app.inject({
      url: '/api/v1/throw/plain-error',
      headers: { [REQUEST_ID_HEADER]: 'proxy-assigned-0042' },
    });
    expect(response.statusCode).toBe(500);
    expect(expectReference(response).requestId).toBe('proxy-assigned-0042');
    const failure = lines.find((line) => line['msg'] === 'request failed');
    expect(failure).toMatchObject({ requestId: 'proxy-assigned-0042', level: 50 });
  });
});
