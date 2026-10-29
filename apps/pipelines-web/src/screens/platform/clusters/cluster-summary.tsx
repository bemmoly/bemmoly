import { useT } from '@bemmoly/core-web';
import type { Cluster, DeployRuntime } from '@bemmoly/module-pipelines/shared';
import { Badge, RelativeTime, type BadgeTone } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';

const TONE: Record<Cluster['status'], BadgeTone> = {
  creating: 'neutral',
  ready: 'ok',
  failed: 'danger',
};

/** The runtime a cluster serves, in the words the runtime choice uses. */
export const runtimeOfCluster = (cluster: Pick<Cluster, 'origin' | 'mode'>): DeployRuntime =>
  cluster.origin === 'attached'
    ? 'attached-cluster'
    : cluster.mode === 'standard'
      ? 'gke-standard'
      : 'gke-autopilot';

/**
 * One cluster as its last check left it: its name and state, what it is and where, its
 * release channel, and each problem as a sentence saying what to grant or turn on.
 */
export function ClusterSummary({ cluster, actions }: { cluster: Cluster; actions?: ReactNode }) {
  const t = useT(pipelinesText);
  const facts = [
    t(`pipelines.runtimes.name.${runtimeOfCluster(cluster)}`),
    t('pipelines.clusters.where', { project: cluster.projectId, location: cluster.location }),
    cluster.releaseChannel
      ? t('pipelines.clusters.channel', { channel: cluster.releaseChannel.toLowerCase() })
      : null,
    cluster.gateway
      ? t('pipelines.clusters.gatewayOwned', {
          namespace: cluster.gateway.namespace,
          name: cluster.gateway.name,
        })
      : null,
  ].filter(Boolean);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="truncate font-mono text-13 font-medium text-tx">{cluster.name}</span>
        <Badge tone={TONE[cluster.status]}>
          {t(`pipelines.clusters.status.${cluster.status}`)}
        </Badge>
        {cluster.lastCheckedAt && (
          <span className="text-12 text-tx-3">
            {t('pipelines.clouds.checked')} <RelativeTime iso={cluster.lastCheckedAt} />
          </span>
        )}
        {actions && <span className="ms-auto flex gap-1">{actions}</span>}
      </div>
      <p className="truncate text-12 text-tx-3">{facts.join(' · ')}</p>
      {cluster.problems.length > 0 && (
        <ul
          aria-label={t('pipelines.clusters.problemsLabel', { name: cluster.name })}
          className="flex list-disc flex-col gap-1 ps-5 text-12 leading-body text-tx-2"
        >
          {cluster.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
