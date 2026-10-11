import type { WindowCounts } from './prom.ts';

/*
 * What a soak is judged on. §20 sets one number for it (Node under 512 MB with 200 people,
 * steady); the rest are the signs of a slow failure that a short run hides: memory or heap
 * that keeps climbing, p95 that drifts up, connections or queues that never drain, errors.
 */

export const NODE_MEMORY_BUDGET_BYTES = 512 * 1024 * 1024;
/** p95 in the last tenth of the run may be at most this much above the first tenth. */
export const MAX_P95_DRIFT = 0.25;
/** Heap growth per hour, past which the run reads as a leak rather than warm-up. */
export const MAX_HEAP_GROWTH_MB_PER_HOUR = 20;

export interface SoakSample {
  at: string;
  rssBytes: number | null;
  heapUsedBytes: number | null;
  eventLoopLagP99Ms: number | null;
  dbPool: {
    active: number | null;
    idle: number | null;
    max: number | null;
    idleInTransaction: number | null;
  };
  queueDepth: number;
  busyQueues: Record<string, number>;
  websockets: number | null;
  window: WindowCounts | null;
  latencyMs: { p50: number | null; p95: number | null; p99: number | null } | null;
  dbConnections: number | null;
  containers: string | null;
}

const numbers = (values: (number | null | undefined)[]) =>
  values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
};

/** Least-squares slope of `values` against hours since the first sample. */
export function slopePerHour(points: { hours: number; value: number }[]): number | null {
  if (points.length < 3) return null;
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.hours, 0) / n;
  const my = points.reduce((s, p) => s + p.value, 0) / n;
  const num = points.reduce((s, p) => s + (p.hours - mx) * (p.value - my), 0);
  const den = points.reduce((s, p) => s + (p.hours - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

const round = (value: number | null, digits = 1) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;

function trend(samples: SoakSample[], read: (s: SoakSample) => number | null, scale = 1) {
  const start = Date.parse(samples[0]?.at ?? '');
  const points = samples
    .map((s) => ({ hours: (Date.parse(s.at) - start) / 3_600_000, value: read(s) }))
    .filter((p): p is { hours: number; value: number } => p.value !== null)
    .map((p) => ({ hours: p.hours, value: p.value / scale }));
  const tenth = Math.max(1, Math.floor(points.length / 10));
  return {
    first: round(median(points.slice(0, tenth).map((p) => p.value))),
    last: round(median(points.slice(-tenth).map((p) => p.value))),
    max: round(points.length ? Math.max(...points.map((p) => p.value)) : null),
    perHour: round(slopePerHour(points), 2),
  };
}

export function summarise(samples: SoakSample[]) {
  const MB = 1024 * 1024;
  const totals = samples.reduce(
    (t, s) => ({
      requests: t.requests + (s.window?.requests ?? 0),
      serverErrors: t.serverErrors + (s.window?.serverErrors ?? 0),
      clientErrors: t.clientErrors + (s.window?.clientErrors ?? 0),
      rateLimited: t.rateLimited + (s.window?.rateLimited ?? 0),
    }),
    { requests: 0, serverErrors: 0, clientErrors: 0, rateLimited: 0 },
  );
  const rss = trend(samples, (s) => s.rssBytes, MB);
  const heap = trend(samples, (s) => s.heapUsedBytes, MB);
  const p95 = trend(samples, (s) => s.latencyMs?.p95 ?? null);
  const p99 = trend(samples, (s) => s.latencyMs?.p99 ?? null);
  const drift = p95.first && p95.last !== null ? (p95.last - p95.first) / p95.first : null;
  const errorRate = totals.requests ? totals.serverErrors / totals.requests : 0;
  const maxRssBytes = Math.max(0, ...numbers(samples.map((s) => s.rssBytes)));
  const minutes =
    samples.length > 1 ? (Date.parse(samples.at(-1)!.at) - Date.parse(samples[0]!.at)) / 60_000 : 0;
  return {
    from: samples[0]?.at ?? null,
    to: samples.at(-1)?.at ?? null,
    minutes: round(minutes),
    samples: samples.length,
    rssMb: rss,
    heapUsedMb: heap,
    eventLoopLagP99Ms: trend(samples, (s) => s.eventLoopLagP99Ms),
    apiP95Ms: { ...p95, driftPercent: drift === null ? null : round(drift * 100) },
    apiP99Ms: p99,
    dbConnections: {
      max: Math.max(0, ...numbers(samples.map((s) => s.dbConnections ?? s.dbPool.active))),
      last: samples.at(-1)?.dbConnections ?? samples.at(-1)?.dbPool.active ?? null,
    },
    dbPoolIdleInTransactionMax: Math.max(
      0,
      ...numbers(samples.map((s) => s.dbPool.idleInTransaction)),
    ),
    queueDepth: {
      max: Math.max(0, ...samples.map((s) => s.queueDepth)),
      last: samples.at(-1)?.queueDepth ?? null,
    },
    websockets: {
      max: Math.max(0, ...numbers(samples.map((s) => s.websockets))),
      last: samples.at(-1)?.websockets ?? null,
    },
    requests: totals,
    errorRatePercent: round(errorRate * 100, 3),
    verdicts: {
      nodeMemoryUnder512Mb: maxRssBytes < NODE_MEMORY_BUDGET_BYTES,
      heapNotClimbing: heap.perHour === null || heap.perHour < MAX_HEAP_GROWTH_MB_PER_HOUR,
      p95DriftUnder25Percent: drift === null || drift < MAX_P95_DRIFT,
      errorRateUnder1Percent: errorRate < 0.01,
      queuesDrained: (samples.at(-1)?.queueDepth ?? 0) === 0,
    },
  };
}
