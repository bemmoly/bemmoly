import type { JobMetrics } from '../../contracts/telemetry.ts';

/**
 * The part of the observability service's job metrics (`getMetrics().jobs`,
 * which the host passes) that the jobs service reports to.
 */
export type JobMetricsHook = Pick<JobMetrics, 'observeQueueDepth' | 'startJob'>;

export const noJobMetrics: JobMetricsHook = {
  observeQueueDepth: () => undefined,
  startJob: () => () => undefined,
};
