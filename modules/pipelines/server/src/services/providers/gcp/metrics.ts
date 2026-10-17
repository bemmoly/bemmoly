import type { MonitoringSeries } from '../../../clients/gcp/monitoring.ts';
import type { MetricsPart, RevisionMetric } from '../contract.ts';
import { placeOf, type GcpContexts } from './context.ts';

/*
 * Canary numbers from Cloud Monitoring, read as the environment's deployer: error rate is
 * 5xx answers over all answers, latency is the 95th percentile. A window's latency is the
 * worst minute's p95, which is conservative on purpose: a canary should not pass because a
 * bad minute was averaged away.
 */

const minuteKey = (at: Date) => Math.floor(at.getTime() / 60_000);

function errorRate(series: MonitoringSeries[]): RevisionMetric {
  const totals = new Map<number, { at: Date; all: number; errors: number }>();
  for (const entry of series) {
    const isError = entry.labels['response_code_class'] === '5xx';
    for (const point of entry.points) {
      const key = minuteKey(point.at);
      const minute = totals.get(key) ?? { at: point.at, all: 0, errors: 0 };
      minute.all += point.value;
      if (isError) minute.errors += point.value;
      totals.set(key, minute);
    }
  }
  const minutes = [...totals.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
  const requests = minutes.reduce((sum, minute) => sum + minute.all, 0);
  const errors = minutes.reduce((sum, minute) => sum + minute.errors, 0);
  return {
    value: requests > 0 ? errors / requests : null,
    requests,
    points: minutes
      .filter((minute) => minute.all > 0)
      .map((minute) => [minute.at, minute.errors / minute.all]),
  };
}

function latency(series: MonitoringSeries[], requests: number): RevisionMetric {
  const points = series
    .flatMap((entry) => entry.points)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((point): [Date, number] => [point.at, point.value]);
  const worst = points.reduce<number | null>(
    (max, [, value]) => (max === null || value > max ? value : max),
    null,
  );
  return { value: requests > 0 ? worst : null, requests, points };
}

export function createGcpMetrics(contexts: GcpContexts): MetricsPart {
  return {
    async revision(target, revision, metric, window) {
      const context = contexts(target.connection);
      const place = placeOf(target, context.config);
      const monitoring = context.deployer(place.projectId).monitoring;
      const query = {
        projectId: place.projectId,
        service: place.service,
        revision,
        from: window.from,
        to: window.to,
      };
      const counts = errorRate(await monitoring.requestCounts(query));
      if (metric === 'error_rate') return counts;
      return latency(await monitoring.latencyP95(query), counts.requests);
    },

    async errorBudget(target) {
      const context = contexts(target.connection);
      const slo = context.config.slos[target.application.key];
      if (!slo || !target.account) return null;
      const fraction = await context
        .deployer(target.account.externalId)
        .monitoring.sloBudgetFraction(target.account.externalId, slo, new Date());
      return fraction === null ? null : Math.min(1, Math.max(0, fraction));
    },
  };
}
