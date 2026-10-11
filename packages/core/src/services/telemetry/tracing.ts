import type { Env } from '../../config/env.ts';
import { trimTrailingSlashes } from '../../utils/slashes.ts';

export type TracingConfig = Pick<Env, 'OTEL_EXPORTER_OTLP_ENDPOINT'> & {
  serviceVersion?: string;
};

export interface TracingHandle {
  readonly enabled: boolean;
  /** Flushes buffered spans and stops the SDK. */
  shutdown(): Promise<void>;
}

/** Probes and scrapes never get spans. */
export const UNTRACED_PATHS: readonly string[] = ['/healthz', '/readyz', '/metrics'];

const DISABLED: TracingHandle = { enabled: false, shutdown: async () => undefined };

let active: TracingHandle = DISABLED;

export function isTracingEnabled(): boolean {
  return active.enabled;
}

/** OTEL_EXPORTER_OTLP_ENDPOINT is the collector's base URL; traces go to its /v1/traces. */
export function tracesUrl(endpoint: string): string {
  return `${trimTrailingSlashes(endpoint)}/v1/traces`;
}

const pathOf = (url: string | undefined) => (url ?? '').split('?')[0] ?? '';

/**
 * Starts OpenTelemetry only when OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise nothing
 * is loaded and every instrumentation stays a no-op. Spans cover Fastify routes,
 * inbound and outbound HTTP (node:http and fetch) and postgres.js queries
 * (through instrumentSqlClient). Headers, bodies and query parameters are never recorded.
 */
export async function startTracing(config: TracingConfig): Promise<TracingHandle> {
  const endpoint = config.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return DISABLED;
  if (active.enabled) return active;

  const [sdkNode, exporter, http, undici, fastifyOtel, resources] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-undici'),
    import('@fastify/otel'),
    import('@opentelemetry/resources'),
  ]);

  const sdk = new sdkNode.NodeSDK({
    serviceName: 'bemmoly',
    ...(config.serviceVersion
      ? { resource: resources.resourceFromAttributes({ 'service.version': config.serviceVersion }) }
      : {}),
    traceExporter: new exporter.OTLPTraceExporter({
      url: tracesUrl(endpoint),
      timeoutMillis: 10_000,
    }),
    instrumentations: [
      new http.HttpInstrumentation({
        ignoreIncomingRequestHook: (request) => UNTRACED_PATHS.includes(pathOf(request.url)),
      }),
      new undici.UndiciInstrumentation(),
      new fastifyOtel.FastifyOtelInstrumentation({
        registerOnInitialization: true,
        ignorePaths: (route) => UNTRACED_PATHS.includes(route.url),
      }),
    ],
  });
  sdk.start();
  active = {
    enabled: true,
    shutdown: async () => {
      active = DISABLED;
      await sdk.shutdown();
    },
  };
  return active;
}
