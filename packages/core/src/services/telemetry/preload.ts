/**
 * Loaded before the server with `node --import @bemmoly/core/telemetry/preload`, so
 * OpenTelemetry can patch modules before they are first imported. Does nothing
 * unless OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */
import { register } from 'node:module';
import { loadEnv } from '../../config/env.ts';
import { startTracing } from './tracing.ts';

const env = loadEnv();

if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  register('@opentelemetry/instrumentation/hook.mjs', import.meta.url);
  const tracing = await startTracing(env);
  process.once('SIGTERM', () => {
    tracing.shutdown().catch((error: unknown) => {
      process.stderr.write(`Tracing shutdown failed: ${String(error)}\n`);
    });
  });
}
