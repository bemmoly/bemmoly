import { Writable } from 'node:stream';
import Fastify, { LogController } from 'fastify';
import { describe, expect, it } from 'vitest';
import { errorCodeOf, httpTelemetry } from './http-telemetry.ts';
import { createMetrics } from './metrics.ts';

function captureLogs() {
  const lines: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { lines, stream };
}

async function buildTestApp(level: 'info' | 'debug' = 'info') {
  const logs = captureLogs();
  const metrics = createMetrics();
  const app = Fastify({
    logger: { level, stream: logs.stream },
    logController: new LogController({ disableRequestLogging: true }),
  });
  await app.register(httpTelemetry, { metrics, actorOf: () => 'user-123' });
  app.get('/api/v1/things/:id', async () => ({ ok: true }));
  app.get('/healthz', async () => ({ status: 'ok' }));
  app.get('/broken', async (_request, reply) =>
    reply.code(409).send({ code: 'conflict', message: 'Changed', requestId: 'r' }),
  );
  return { app, metrics, logs: logs.lines };
}

describe('http telemetry', () => {
  it('writes one summary line per request with route, status, duration and request id', async () => {
    const { app, logs } = await buildTestApp();
    await app.inject({ url: '/api/v1/things/42' });
    const summaries = logs.filter((line) => line['msg'] === 'request completed');
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      method: 'GET',
      route: '/api/v1/things/:id',
      status: 200,
      reqId: expect.any(String),
      userId: 'user-123',
    });
    expect(summaries[0]?.['durationMs']).toEqual(expect.any(Number));
    expect(logs.some((line) => line['msg'] === 'incoming request')).toBe(false);
  });

  it('logs probes at debug so they do not drown the info stream', async () => {
    const { app, logs } = await buildTestApp('info');
    await app.inject({ url: '/healthz' });
    expect(logs.filter((line) => line['msg'] === 'request completed')).toHaveLength(0);
    const verbose = await buildTestApp('debug');
    await verbose.app.inject({ url: '/healthz' });
    expect(verbose.logs.filter((line) => line['msg'] === 'request completed')).toHaveLength(1);
  });

  it('labels by route pattern, never by raw URL, and counts error codes', async () => {
    const { app, metrics } = await buildTestApp();
    await app.inject({ url: '/api/v1/things/1' });
    await app.inject({ url: '/api/v1/things/2' });
    await app.inject({ url: '/broken' });
    await app.inject({ url: '/nowhere/at/all' });
    const text = await metrics.render();
    expect(text).toMatch(
      /bemmoly_http_request_duration_seconds_count\{method="GET",route="\/api\/v1\/things\/:id",status_code="200"\} 2/,
    );
    expect(text).not.toContain('/api/v1/things/1');
    expect(text).not.toContain('/nowhere');
    expect(text).toMatch(/route="\(unmatched\)",status_code="404"/);
    expect(text).toMatch(/bemmoly_http_errors_total\{code="conflict",status_code="409"\} 1/);
    expect(text).toMatch(/bemmoly_http_requests_in_flight 0/);
  });

  it('reads error codes only from the shared enum', () => {
    expect(errorCodeOf('{"code":"rate_limited","message":"x","requestId":"r"}')).toBe(
      'rate_limited',
    );
    expect(errorCodeOf('{"code":"made_up_code"}')).toBe('unknown');
    expect(errorCodeOf('<html>')).toBe('unknown');
    expect(errorCodeOf('null')).toBe('unknown');
    expect(errorCodeOf(Buffer.from('{}'))).toBe('unknown');
  });
});
