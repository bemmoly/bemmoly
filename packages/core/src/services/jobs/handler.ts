import type { Job } from 'pg-boss';
import type { Logger } from '../../config/logger.ts';
import type { JobDefinition } from '../../modules/registries.ts';
import type { JobEnvelope } from './enqueue.ts';
import { noJobMetrics, type JobMetricsHook } from './metrics.ts';

function unwrap(data: unknown): JobEnvelope {
  if (typeof data === 'object' && data !== null && 'payload' in data) return data as JobEnvelope;
  // Scheduled runs and jobs sent outside the kernel carry the payload bare.
  return { payload: (data ?? {}) as Record<string, unknown> };
}

/**
 * The one thin wrapper every job runs through: unwrap the payload, log start
 * and finish with the request id, call the definition's handler (which calls
 * a service). A thrown error is logged and rethrown so pg-boss retries.
 */
export function wrapHandler(
  definition: JobDefinition,
  logger: Logger,
  metrics: JobMetricsHook = noJobMetrics,
) {
  const retryLimit = definition.retryLimit ?? 2;
  return async (jobs: Job<unknown>[]): Promise<void> => {
    for (const job of jobs) {
      const { payload, requestId = job.id } = unwrap(job.data);
      const log = logger.child({ job: definition.name, jobId: job.id, requestId });
      const started = performance.now();
      const done = metrics.startJob(definition.name);
      log.info({ attempt: job.retryCount + 1 }, 'job started');
      try {
        await definition.handle(payload, { jobId: job.id, signal: job.signal, requestId });
        done('completed');
        log.info({ ms: Math.round(performance.now() - started) }, 'job finished');
      } catch (error) {
        done(job.signal.aborted ? 'expired' : job.retryCount < retryLimit ? 'retried' : 'failed');
        log.error({ err: error, ms: Math.round(performance.now() - started) }, 'job failed');
        throw error;
      }
    }
  };
}
