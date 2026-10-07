import { createMetrics } from '@bemmoly/core/telemetry';
import { apiErrorBodySchema } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';
import { shippedModules, TEST_ENV } from './test-support.ts';

const TOKEN = 'metrics-token-for-tests-0123456789abcdef';

async function appWithToken(token: string | undefined) {
  const metrics = createMetrics();
  const app = await buildApp({
    env: { ...TEST_ENV, ...(token ? { BEMMOLY_METRICS_TOKEN: token } : {}) },
    modules: await shippedModules(),
    metrics,
    logger: false,
  });
  return { app, metrics };
}

describe('GET /metrics', () => {
  it('does not exist until a metrics token is configured', async () => {
    const { app } = await appWithToken(undefined);
    const response = await app.inject({
      url: '/metrics',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(404);
    expect(apiErrorBodySchema.parse(response.json()).code).toBe('not_found');
  });

  it.each([
    ['no credentials', undefined],
    ['a wrong token', `Bearer ${TOKEN}-wrong`],
    ['the token without the Bearer scheme', TOKEN],
    ['a basic credential', `Basic ${Buffer.from(`prometheus:${TOKEN}`).toString('base64')}`],
  ])('answers 401 with the shared error body for %s', async (_case, authorization) => {
    const { app } = await appWithToken(TOKEN);
    const response = await app.inject({
      url: '/metrics',
      headers: authorization ? { authorization } : {},
    });
    expect(response.statusCode).toBe(401);
    const body = apiErrorBodySchema.parse(response.json());
    expect(body.code).toBe('unauthenticated');
    expect(body.requestId).toBe(response.headers['x-request-id']);
    expect(response.body).not.toContain('bemmoly_http');
  });

  it('serves the Prometheus exposition with per-route latency histograms', async () => {
    const { app } = await appWithToken(TOKEN);
    await app.inject({ url: '/api/v1/modules' });
    await app.inject({ url: '/api/v1/does-not-exist' });
    const response = await app.inject({
      url: '/metrics',
      headers: { authorization: `Bearer ${TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/^text\/plain; version=0\.0\.4/);
    expect(response.headers['cache-control']).toBe('no-store');
    const text = response.body;
    expect(text).toContain('# TYPE bemmoly_http_request_duration_seconds histogram');
    expect(text).toMatch(
      /bemmoly_http_request_duration_seconds_bucket\{le="0\.08",method="GET",route="\/api\/v1\/modules",status_code="200"\} 1/,
    );
    expect(text).toMatch(/bemmoly_http_errors_total\{code="not_found",status_code="404"\} 1/);
    expect(text).toContain('bemmoly_http_requests_in_flight');
    for (const name of [
      'bemmoly_db_pool_connections',
      'bemmoly_job_queue_depth',
      'bemmoly_job_duration_seconds',
      'bemmoly_websocket_connections',
      'bemmoly_backup_last_success_age_seconds',
      'bemmoly_ai_tokens_total',
      'bemmoly_ai_cost_usd_total',
    ]) {
      expect(text).toContain(`# TYPE ${name} `);
    }
  });
});
