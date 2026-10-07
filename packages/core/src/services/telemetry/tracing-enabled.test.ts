import { trace } from '@opentelemetry/api';
import { describe, expect, it } from 'vitest';
import { aiTelemetrySettings } from './ai-telemetry.ts';
import { isTracingEnabled, startTracing } from './tracing.ts';

describe('tracing, with an OTLP endpoint', () => {
  it('starts the SDK, records spans, keeps AI inputs and outputs off, and shuts down', async () => {
    const handle = await startTracing({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:9' });
    try {
      expect(handle.enabled).toBe(true);
      expect(isTracingEnabled()).toBe(true);
      const span = trace.getTracer('probe').startSpan('probe');
      expect(span.isRecording()).toBe(true);
      expect(aiTelemetrySettings('page.tldr')).toMatchObject({
        isEnabled: true,
        recordInputs: false,
        recordOutputs: false,
      });
      expect(await startTracing({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:9' })).toBe(
        handle,
      );
    } finally {
      await handle.shutdown();
    }
    expect(isTracingEnabled()).toBe(false);
  });
});
