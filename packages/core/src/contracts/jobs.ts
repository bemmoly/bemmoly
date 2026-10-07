import type { SqlExecutor } from './sql.ts';

export interface QueuedJobContext {
  jobId: string;
  signal: AbortSignal;
}

export type QueuedJobHandler<Payload = unknown> = (
  payload: Payload,
  ctx: QueuedJobContext,
) => Promise<void>;

export interface JobRegisterOptions {
  /** Cron expression; the queue enqueues `{}` on this schedule. */
  schedule?: string;
  /** Queue-level retries; 0 when the handler manages its own backoff. */
  retryLimit?: number;
  retryDelaySeconds?: number;
  retryBackoff?: boolean;
  /** Maximum handlers of this job running at once in one process. */
  concurrency?: number;
}

export interface EnqueueOptions {
  /** Idempotency key; with `singleton`, a second job with the same key is dropped while one waits. */
  key?: string;
  singleton?: boolean;
  /** Delay, as a date or a number of seconds from now. */
  startAfter?: Date | number;
  /** Enqueue inside the caller's transaction so the job exists only if it commits. */
  transaction?: SqlExecutor;
}

/**
 * The kernel's job queue, backed by pg-boss. Named apart from the module-facing
 * `JobRegistry` (`add(job)`), which records a module's jobs at load time.
 */
export interface JobQueue {
  register<Payload>(
    name: string,
    handler: QueuedJobHandler<Payload>,
    options?: JobRegisterOptions,
  ): void;
  /** Returns the job id, or null when a singleton key collapsed it into a waiting job. */
  enqueue(name: string, payload: object, options?: EnqueueOptions): Promise<string | null>;
}
