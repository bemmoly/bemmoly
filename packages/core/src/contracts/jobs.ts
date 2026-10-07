export interface SendJobOptions {
  /** Collapses duplicates: one queued or active job per key (pg-boss singletonKey). */
  singletonKey?: string;
  startAfter?: Date;
  retryLimit?: number;
}

/**
 * Enqueues work for the worker role. Handlers are registered through the
 * JobRegistry; this is the producer side that services use.
 */
export interface JobQueue {
  /** Resolves to the job id, or null when a job with the same singleton key exists. */
  send(name: string, payload: unknown, options?: SendJobOptions): Promise<string | null>;
}
