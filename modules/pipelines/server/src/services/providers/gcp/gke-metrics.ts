import type { MetricsPart } from '../contract.ts';
import { identityFor } from './gke-access.ts';
import { errorRate, latency } from './metrics.ts';
import type { GcpContexts } from './context.ts';

/*
 * Canary numbers for GKE from the Gateway's load balancer in Cloud Monitoring, the same
 * source Cloud Run's numbers come from, so no agent or scrape runs in the cluster. Each
 * revision has its own Service, so each is its own backend and is measured on its own. The
 * load balancer reports a minute or two late; samples that see no requests yet wait.
 *
 * An attached cluster whose owners route through their own Gateway class may not report
 * these; the judge then finds no metrics and asks a person, as it does on Cloud Run.
 */

export function createGkeMetrics(contexts: GcpContexts): MetricsPart {
  return {
    async revision(target, revision, metric, window) {
      const cluster = target.placement?.cluster;
      if (!cluster) return null;
      const sameProject = target.account?.externalId === cluster.projectId;
      const monitoring = identityFor(
        contexts,
        target.connection,
        cluster,
        sameProject ? (target.account?.config ?? null) : null,
      ).monitoring;
      const query = {
        projectId: cluster.projectId,
        namespace: target.placement?.namespace ?? 'default',
        service: revision,
        from: window.from,
        to: window.to,
      };
      const counts = errorRate(await monitoring.backendRequestCounts(query));
      if (metric === 'error_rate') return counts;
      return latency(await monitoring.backendLatencyP95(query), counts.requests);
    },

    /** Service Monitoring SLOs are set per Cloud Run service today; GKE services have none. */
    async errorBudget() {
      return null;
    },
  };
}
