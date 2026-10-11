import type { PgBoss } from 'pg-boss';
import type { Logger } from '../../config/logger.ts';
import type { JobDefinition } from '../../modules/registries.ts';
import { wrapHandler } from './handler.ts';
import type { JobMetricsHook } from './metrics.ts';
import type { JobSlots } from './slots.ts';

/** How long an idle queue waits before it looks for work again. */
export const DEFAULT_POLLING_INTERVAL_SECONDS = 2;

export interface QueueWorkOptions {
  slots: JobSlots;
  logger: Logger;
  metrics: JobMetricsHook;
  pollingIntervalSeconds?: number;
}

/** Fetch loops for a queue: its concurrency, never more than the process may run at once. */
export function loopsFor(job: JobDefinition, slots: JobSlots): number {
  const wanted = Math.floor(job.concurrency ?? 1);
  return Math.min(Math.max(1, wanted), slots.limit);
}

/**
 * Works a queue with one fetch loop per unit of concurrency. Each loop takes one job at a
 * time, so retries, expiry, the abort signal and the singleton policy stay per job. A loop
 * whose job succeeded asks pg-boss for the next one at once instead of sleeping out the
 * polling interval, so a backlog drains as fast as handlers finish; an empty fetch (or a
 * failure, which backs off on its own) falls back to polling. pg-boss's own burst mode only
 * engages for batches larger than one, which would make retries and expiry shared by a
 * batch, hence the wake-up here.
 */
export async function workQueue(
  boss: PgBoss,
  job: JobDefinition,
  options: QueueWorkOptions,
): Promise<void> {
  const handle = wrapHandler(job, options.logger, options.metrics);
  const pollingIntervalSeconds = options.pollingIntervalSeconds ?? DEFAULT_POLLING_INTERVAL_SECONDS;
  for (let remaining = loopsFor(job, options.slots); remaining > 0; remaining -= 1) {
    // The loop's id arrives once work() resolves, before its first fetch can return a job.
    const loop: { id?: string } = {};
    loop.id = await boss.work(
      job.name,
      { batchSize: 1, localConcurrency: 1, pollingIntervalSeconds },
      async (jobs) => {
        await options.slots.run(() => handle(jobs), jobs[0]?.signal);
        if (loop.id) boss.notifyWorker(loop.id);
      },
    );
  }
}
