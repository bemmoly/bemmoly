/**
 * Hooks other kernel services call to feed /metrics. The implementation lives in
 * services/telemetry; callers get it from `getMetrics()` and depend only on these types.
 */

/** A value now, or a promise of one. Sources are read when Prometheus scrapes. */
export type MetricSource<T> = () => T | Promise<T>;

export interface DatabasePoolStats {
  /** Configured maximum connections for this process. */
  max: number;
  /** Connections running a statement. */
  active: number;
  /** Open and idle connections. */
  idle: number;
  /** Connections idle inside an open transaction (a leak if it stays above zero). */
  idleInTransaction: number;
}

export interface DatabaseMetrics {
  /** Register the pool stats source; read on each scrape. A second call replaces the first. */
  observePool(source: MetricSource<DatabasePoolStats>): void;
}

export type JobOutcome = 'completed' | 'failed' | 'retried' | 'expired';

export interface JobMetrics {
  /** Register a source of queue depth (jobs waiting) keyed by queue name. */
  observeQueueDepth(source: MetricSource<Readonly<Record<string, number>>>): void;
  /** Start timing one job; call the returned function exactly once with its outcome. */
  startJob(queue: string): (outcome: JobOutcome) => void;
  /** Record a job whose duration was measured elsewhere. */
  recordJob(queue: string, outcome: JobOutcome, durationSeconds: number): void;
}

export interface RealtimeMetrics {
  connectionOpened(): void;
  connectionClosed(): void;
}

export interface BackupMetrics {
  /** Register a source for the finish time of the last verified backup (null: none yet). */
  observeLastGoodBackup(source: MetricSource<Date | null>): void;
  /** Record a backup that just passed verification. */
  recordGoodBackup(finishedAt: Date): void;
}

/** The model roles of tech design §11.1. */
export type AiRole = 'fast' | 'standard' | 'strong' | 'embedding';

export interface AiUsage {
  role: AiRole;
  /** Catalog provider id, as stored; never a hard-coded vendor name. */
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  /** Cost of this call in US dollars, from the catalog's prices. */
  costUsd: number;
}

export interface AiMetrics {
  recordUsage(usage: AiUsage): void;
}

export interface MetricsHooks {
  database: DatabaseMetrics;
  jobs: JobMetrics;
  realtime: RealtimeMetrics;
  backups: BackupMetrics;
  ai: AiMetrics;
}
