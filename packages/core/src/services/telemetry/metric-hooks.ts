import { Counter, Gauge, Histogram, type Registry } from 'prom-client';
import type {
  AiMetrics,
  BackupMetrics,
  DatabaseMetrics,
  DatabasePoolStats,
  JobMetrics,
  MetricSource,
  RealtimeMetrics,
} from '../../contracts/telemetry.ts';

const JOB_BUCKETS = [0.05, 0.1, 0.5, 1, 5, 15, 30, 60, 300, 900, 3600];

/**
 * Reads a registered source at scrape time. A failing source leaves its gauge
 * at the last value and is counted, so one broken probe never blanks /metrics.
 * Call `registerFailures()` after every gauge exists: metrics render in
 * registration order, and the count must render after the sources that feed it.
 */
export function createSourceReader(registry: Registry) {
  const failures = new Counter({
    name: 'bemmoly_metrics_source_errors_total',
    help: 'Metric sources that threw while Prometheus scraped, by source.',
    labelNames: ['source'],
    registers: [],
  });
  const read = async function read<T>(
    name: string,
    source: MetricSource<T> | undefined,
    apply: (value: T) => void,
  ): Promise<void> {
    if (!source) return;
    let value: T;
    try {
      value = await source();
    } catch {
      failures.inc({ source: name });
      return;
    }
    apply(value);
  };
  return { read, registerFailures: () => registry.registerMetric(failures) };
}

type SourceReader = ReturnType<typeof createSourceReader>['read'];

export function createDatabaseMetrics(registry: Registry, read: SourceReader): DatabaseMetrics {
  let source: MetricSource<DatabasePoolStats> | undefined;
  new Gauge({
    name: 'bemmoly_db_pool_connections',
    help: 'Database connections of this process by state (max is the configured ceiling).',
    labelNames: ['state'],
    registers: [registry],
    async collect() {
      await read('db_pool', source, (stats) => {
        this.set({ state: 'max' }, stats.max);
        this.set({ state: 'active' }, stats.active);
        this.set({ state: 'idle' }, stats.idle);
        this.set({ state: 'idle_in_transaction' }, stats.idleInTransaction);
      });
    },
  });
  return {
    observePool(next) {
      source = next;
    },
  };
}

export function createJobMetrics(registry: Registry, read: SourceReader): JobMetrics {
  let depthSource: MetricSource<Readonly<Record<string, number>>> | undefined;
  new Gauge({
    name: 'bemmoly_job_queue_depth',
    help: 'Jobs waiting to run, by queue.',
    labelNames: ['queue'],
    registers: [registry],
    async collect() {
      await read('job_queue_depth', depthSource, (depths) => {
        this.reset();
        for (const [queue, depth] of Object.entries(depths)) this.set({ queue }, depth);
      });
    },
  });
  const duration = new Histogram({
    name: 'bemmoly_job_duration_seconds',
    help: 'Job run time by queue and outcome.',
    labelNames: ['queue', 'outcome'],
    buckets: JOB_BUCKETS,
    registers: [registry],
  });
  return {
    observeQueueDepth(source) {
      depthSource = source;
    },
    startJob(queue) {
      const stop = duration.startTimer({ queue });
      let finished = false;
      return (outcome) => {
        if (finished) return;
        finished = true;
        stop({ outcome });
      };
    },
    recordJob(queue, outcome, durationSeconds) {
      duration.observe({ queue, outcome }, durationSeconds);
    },
  };
}

export function createRealtimeMetrics(registry: Registry): RealtimeMetrics {
  const connections = new Gauge({
    name: 'bemmoly_websocket_connections',
    help: 'Open WebSocket connections on this process.',
    registers: [registry],
  });
  return {
    connectionOpened: () => connections.inc(),
    connectionClosed: () => connections.dec(),
  };
}

export function createBackupMetrics(
  registry: Registry,
  read: SourceReader,
  now: () => Date,
): BackupMetrics {
  let source: MetricSource<Date | null> | undefined;
  let recorded: Date | null = null;
  const latest = async (): Promise<Date | null> => {
    let fromSource: Date | null = null;
    await read('last_good_backup', source, (value) => {
      fromSource = value;
    });
    const candidates = [recorded, fromSource].filter((value): value is Date => value !== null);
    return candidates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  };
  new Gauge({
    name: 'bemmoly_backup_last_success_age_seconds',
    help: 'Seconds since the last verified backup finished; +Inf when there has never been one.',
    registers: [registry],
    async collect() {
      const last = await latest();
      this.set(last ? Math.max(0, (now().getTime() - last.getTime()) / 1000) : Infinity);
    },
  });
  return {
    observeLastGoodBackup(next) {
      source = next;
    },
    recordGoodBackup(finishedAt) {
      if (!recorded || finishedAt > recorded) recorded = finishedAt;
    },
  };
}

export function createAiMetrics(registry: Registry): AiMetrics {
  const tokens = new Counter({
    name: 'bemmoly_ai_tokens_total',
    help: 'AI tokens by model role, provider, model and kind (input, output, cached_input).',
    labelNames: ['role', 'provider', 'model', 'kind'],
    registers: [registry],
  });
  const cost = new Counter({
    name: 'bemmoly_ai_cost_usd_total',
    help: 'AI spend in US dollars by model role, provider and model.',
    labelNames: ['role', 'provider', 'model'],
    registers: [registry],
  });
  return {
    recordUsage(usage) {
      const labels = { role: usage.role, provider: usage.provider, model: usage.model };
      tokens.inc({ ...labels, kind: 'input' }, usage.inputTokens);
      tokens.inc({ ...labels, kind: 'output' }, usage.outputTokens);
      if (usage.cachedInputTokens) {
        tokens.inc({ ...labels, kind: 'cached_input' }, usage.cachedInputTokens);
      }
      cost.inc(labels, usage.costUsd);
    },
  };
}
