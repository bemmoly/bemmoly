import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from 'prom-client';
import type { MetricsHooks } from '../../contracts/telemetry.ts';
import {
  createAiMetrics,
  createBackupMetrics,
  createDatabaseMetrics,
  createJobMetrics,
  createRealtimeMetrics,
  createSourceReader,
} from './metric-hooks.ts';

/** Bucket edges include the API budgets of tech design §20 (40, 80, 100, 150 ms). */
export const LATENCY_BUCKETS = [
  0.005, 0.01, 0.025, 0.04, 0.05, 0.08, 0.1, 0.15, 0.25, 0.5, 1, 2.5, 5, 10,
];

/** Route label for requests that matched no route, so unknown paths cannot explode cardinality. */
export const UNMATCHED_ROUTE = '(unmatched)';

export interface HttpSample {
  method: string;
  /** The route pattern (`/api/v1/issues/:id`), never the raw URL. */
  route: string;
  statusCode: number;
  durationSeconds: number;
  /** The `code` of the error body, for responses of 400 and above. */
  errorCode?: string;
}

export interface HttpMetrics {
  requestStarted(): void;
  requestFinished(sample: HttpSample): void;
}

export interface Metrics extends MetricsHooks {
  readonly registry: Registry;
  readonly http: HttpMetrics;
  /** The Prometheus text exposition of every metric. */
  render(): Promise<string>;
  readonly contentType: string;
}

export interface CreateMetricsOptions {
  /** Process metrics (CPU, memory, event loop, GC). On for the server, off in most tests. */
  processMetrics?: boolean;
  now?: () => Date;
}

function createHttpMetrics(registry: Registry): HttpMetrics {
  const duration = new Histogram({
    name: 'bemmoly_http_request_duration_seconds',
    help: 'HTTP request duration by method, route pattern and status code.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: LATENCY_BUCKETS,
    registers: [registry],
  });
  const inFlight = new Gauge({
    name: 'bemmoly_http_requests_in_flight',
    help: 'HTTP requests being handled right now.',
    registers: [registry],
  });
  const errors = new Counter({
    name: 'bemmoly_http_errors_total',
    help: 'HTTP responses of 400 and above by error code and status code.',
    labelNames: ['code', 'status_code'],
    registers: [registry],
  });
  return {
    requestStarted: () => inFlight.inc(),
    requestFinished(sample) {
      inFlight.dec();
      const statusCode = String(sample.statusCode);
      duration.observe(
        { method: sample.method, route: sample.route, status_code: statusCode },
        sample.durationSeconds,
      );
      if (sample.statusCode >= 400) {
        errors.inc({ code: sample.errorCode ?? 'unknown', status_code: statusCode });
      }
    },
  };
}

/** A fresh, isolated set of metrics. The server uses one per process through getMetrics(). */
export function createMetrics(options: CreateMetricsOptions = {}): Metrics {
  const registry = new Registry();
  if (options.processMetrics) collectDefaultMetrics({ register: registry, prefix: 'bemmoly_' });
  const { read, registerFailures } = createSourceReader(registry);
  const metrics: Metrics = {
    registry,
    http: createHttpMetrics(registry),
    database: createDatabaseMetrics(registry, read),
    jobs: createJobMetrics(registry, read),
    realtime: createRealtimeMetrics(registry),
    backups: createBackupMetrics(registry, read, options.now ?? (() => new Date())),
    ai: createAiMetrics(registry),
    render: () => registry.metrics(),
    contentType: registry.contentType,
  };
  registerFailures();
  return metrics;
}

let processMetrics: Metrics | undefined;

/**
 * The process-wide metrics. Kernel services call the hooks on it, for example
 * `getMetrics().jobs.startJob('system.backup')`; tests build their own with createMetrics().
 */
export function getMetrics(): Metrics {
  processMetrics ??= createMetrics({ processMetrics: true });
  return processMetrics;
}
