import { trace } from '@opentelemetry/api';
import { performance } from 'node:perf_hooks';
import { describe, expect, it, vi } from 'vitest';
import type { SqlClient } from '../../clients/index.ts';
import { aiTelemetrySettings } from './ai-telemetry.ts';
import { instrumentSqlClient } from './postgres-tracing.ts';
import { isTracingEnabled, startTracing, tracesUrl } from './tracing.ts';

const loaded = vi.hoisted(() => ({ sdk: false }));

vi.mock('@opentelemetry/sdk-node', async (importOriginal) => {
  loaded.sdk = true;
  return importOriginal();
});

describe('tracing, off by default', () => {
  it('loads nothing and registers no tracer provider without an OTLP endpoint', async () => {
    const handle = await startTracing({ OTEL_EXPORTER_OTLP_ENDPOINT: undefined });
    expect(handle.enabled).toBe(false);
    expect(isTracingEnabled()).toBe(false);
    expect(loaded.sdk).toBe(false);
    const span = trace.getTracer('probe').startSpan('probe');
    expect(span.isRecording()).toBe(false);
    span.end();
    await handle.shutdown();
  });

  it('leaves the SQL client untouched while tracing is off', () => {
    const sql = (() => undefined) as unknown as SqlClient;
    expect(instrumentSqlClient(sql)).toBe(sql);
  });

  it('never records AI prompts or outputs', () => {
    expect(aiTelemetrySettings('issue.summary')).toEqual({
      isEnabled: false,
      recordInputs: false,
      recordOutputs: false,
      functionId: 'issue.summary',
    });
  });

  it('sends traces to the collector path under the configured base URL', () => {
    expect(tracesUrl('http://collector:4318')).toBe('http://collector:4318/v1/traces');
    expect(tracesUrl('http://collector:4318/')).toBe('http://collector:4318/v1/traces');
  });

  it('builds the traces URL in linear time from a hostile endpoint', () => {
    const endpoint = `http://collector:4318${'/'.repeat(100_000)}x`;
    const start = performance.now();
    expect(tracesUrl(endpoint)).toBe(`${endpoint}/v1/traces`);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
