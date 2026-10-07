/**
 * The job metrics the jobs service reports to. Same method names and shapes
 * as the observability service's `getMetrics().jobs`, which the host passes;
 * kept local so the jobs service does not depend on the metrics backend.
 */
export type JobRunOutcome = 'completed' | 'failed' | 'retried' | 'expired';

export interface JobMetricsHook {
  observeQueueDepth(
    source: () => Readonly<Record<string, number>> | Promise<Readonly<Record<string, number>>>,
  ): void;
  startJob(queue: string): (outcome: JobRunOutcome) => void;
}

export const noJobMetrics: JobMetricsHook = {
  observeQueueDepth: () => undefined,
  startJob: () => () => undefined,
};
