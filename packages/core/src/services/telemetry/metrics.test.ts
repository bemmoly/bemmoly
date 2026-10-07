import { describe, expect, it } from 'vitest';
import { createMetrics } from './metrics.ts';

const valueOf = (text: string, series: string): number | undefined => {
  const line = text.split('\n').find((candidate) => candidate.startsWith(`${series} `));
  return line === undefined ? undefined : Number(line.slice(series.length + 1));
};

describe('metrics', () => {
  it('records request latency per route pattern with the budget buckets', async () => {
    const metrics = createMetrics();
    metrics.http.requestStarted();
    metrics.http.requestFinished({
      method: 'GET',
      route: '/api/v1/modules',
      statusCode: 200,
      durationSeconds: 0.03,
    });
    const text = await metrics.render();
    const labels = 'method="GET",route="/api/v1/modules",status_code="200"';
    expect(
      valueOf(text, `bemmoly_http_request_duration_seconds_bucket{le="0.025",${labels}}`),
    ).toBe(0);
    expect(valueOf(text, `bemmoly_http_request_duration_seconds_bucket{le="0.04",${labels}}`)).toBe(
      1,
    );
    expect(valueOf(text, `bemmoly_http_request_duration_seconds_count{${labels}}`)).toBe(1);
    expect(valueOf(text, 'bemmoly_http_requests_in_flight')).toBe(0);
  });

  it('counts errors by code and status', async () => {
    const metrics = createMetrics();
    for (const errorCode of ['not_found', 'not_found', undefined]) {
      metrics.http.requestStarted();
      metrics.http.requestFinished({
        method: 'GET',
        route: '(unmatched)',
        statusCode: 404,
        durationSeconds: 0.001,
        ...(errorCode ? { errorCode } : {}),
      });
    }
    const text = await metrics.render();
    expect(valueOf(text, 'bemmoly_http_errors_total{code="not_found",status_code="404"}')).toBe(2);
    expect(valueOf(text, 'bemmoly_http_errors_total{code="unknown",status_code="404"}')).toBe(1);
  });

  it('reads pool stats and queue depth from registered sources at scrape time', async () => {
    const metrics = createMetrics();
    metrics.database.observePool(() => ({ max: 10, active: 2, idle: 3, idleInTransaction: 1 }));
    let depth = 4;
    metrics.jobs.observeQueueDepth(async () => ({ 'system.backup': depth, 'email.send': 0 }));
    let text = await metrics.render();
    expect(valueOf(text, 'bemmoly_db_pool_connections{state="active"}')).toBe(2);
    expect(valueOf(text, 'bemmoly_db_pool_connections{state="idle_in_transaction"}')).toBe(1);
    expect(valueOf(text, 'bemmoly_job_queue_depth{queue="system.backup"}')).toBe(4);
    depth = 0;
    text = await metrics.render();
    expect(valueOf(text, 'bemmoly_job_queue_depth{queue="system.backup"}')).toBe(0);
  });

  it('times jobs once, whatever the caller does', async () => {
    const metrics = createMetrics();
    const done = metrics.jobs.startJob('email.send');
    done('completed');
    done('failed');
    metrics.jobs.recordJob('system.backup', 'failed', 12);
    const text = await metrics.render();
    expect(
      valueOf(text, 'bemmoly_job_duration_seconds_count{queue="email.send",outcome="completed"}'),
    ).toBe(1);
    expect(
      valueOf(text, 'bemmoly_job_duration_seconds_count{queue="email.send",outcome="failed"}'),
    ).toBeUndefined();
    expect(
      valueOf(text, 'bemmoly_job_duration_seconds_sum{queue="system.backup",outcome="failed"}'),
    ).toBe(12);
  });

  it('tracks WebSocket connections', async () => {
    const metrics = createMetrics();
    metrics.realtime.connectionOpened();
    metrics.realtime.connectionOpened();
    metrics.realtime.connectionClosed();
    expect(valueOf(await metrics.render(), 'bemmoly_websocket_connections')).toBe(1);
  });

  it('reports the age of the last good backup, +Inf before the first one', async () => {
    let now = new Date('2026-10-07T12:00:00Z');
    const metrics = createMetrics({ now: () => now });
    expect(await metrics.render()).toContain('bemmoly_backup_last_success_age_seconds +Inf');
    metrics.backups.observeLastGoodBackup(() => new Date('2026-10-07T02:00:00Z'));
    expect(valueOf(await metrics.render(), 'bemmoly_backup_last_success_age_seconds')).toBe(36_000);
    metrics.backups.recordGoodBackup(new Date('2026-10-07T11:00:00Z'));
    now = new Date('2026-10-07T11:30:00Z');
    expect(valueOf(await metrics.render(), 'bemmoly_backup_last_success_age_seconds')).toBe(1_800);
  });

  it('counts AI tokens and cost per role, provider and model', async () => {
    const metrics = createMetrics();
    const usage = { role: 'standard', provider: 'catalog-provider', model: 'model-a' } as const;
    metrics.ai.recordUsage({
      ...usage,
      inputTokens: 1000,
      outputTokens: 200,
      cachedInputTokens: 600,
      costUsd: 0.0125,
    });
    metrics.ai.recordUsage({ ...usage, inputTokens: 500, outputTokens: 100, costUsd: 0.005 });
    const text = await metrics.render();
    const labels = 'role="standard",provider="catalog-provider",model="model-a"';
    expect(valueOf(text, `bemmoly_ai_tokens_total{${labels},kind="input"}`)).toBe(1500);
    expect(valueOf(text, `bemmoly_ai_tokens_total{${labels},kind="cached_input"}`)).toBe(600);
    expect(valueOf(text, `bemmoly_ai_cost_usd_total{${labels}}`)).toBeCloseTo(0.0175);
  });

  it('counts a failing source instead of failing the scrape', async () => {
    const metrics = createMetrics();
    metrics.jobs.observeQueueDepth(() => {
      throw new Error('queue unavailable');
    });
    const text = await metrics.render();
    expect(valueOf(text, 'bemmoly_metrics_source_errors_total{source="job_queue_depth"}')).toBe(1);
  });

  it('keeps each instance isolated and exposes process metrics only when asked', async () => {
    const bare = await createMetrics().render();
    expect(bare).not.toContain('bemmoly_process_cpu');
    const full = await createMetrics({ processMetrics: true }).render();
    expect(full).toContain('bemmoly_process_cpu_user_seconds_total');
    expect(full).toContain('bemmoly_nodejs_eventloop_lag_seconds');
  });
});
