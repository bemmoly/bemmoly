import { useT } from '@bemmoly/core-web';
import type { CloudConnection, Cluster, Environment } from '@bemmoly/module-pipelines/shared';
import { Button } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useClusterWrites } from '../../../hooks/use-runtimes.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { ClusterSummary } from './cluster-summary.tsx';

/**
 * One environment and its cluster. Without one it says applications run on Cloud Run there
 * and offers to create one (managed connection) or attach one (attached connection).
 */
export function EnvironmentRow({
  environment,
  cluster,
  connection,
  onAdd,
  onForget,
}: {
  environment: Environment;
  cluster: Cluster | undefined;
  connection: CloudConnection | null;
  onAdd: () => void;
  onForget: (cluster: Cluster) => void;
}) {
  const t = useT(pipelinesText);
  const { check } = useClusterWrites();
  const forgettable = cluster && (cluster.origin === 'attached' || cluster.status === 'failed');
  return (
    <li
      aria-label={environment.name}
      className="flex flex-col gap-2 border-t border-line-2 px-4 py-3 md:flex-row md:gap-6"
    >
      <div className="flex w-48 shrink-0 flex-col">
        <span className="truncate text-13 font-medium text-tx">{environment.name}</span>
        <span className="truncate font-mono text-12 text-tx-3">{environment.key}</span>
      </div>
      <div className="min-w-0 flex-1">
        {cluster ? (
          <>
            <ClusterSummary
              cluster={cluster}
              actions={
                <>
                  <Button
                    size="xs"
                    variant="ghost"
                    loading={check.isPending && check.variables === cluster.id}
                    onClick={() => check.mutate(cluster.id)}
                  >
                    {t('pipelines.clouds.checkAgain')}
                  </Button>
                  {forgettable && (
                    <Button size="xs" variant="ghost" onClick={() => onForget(cluster)}>
                      {t('pipelines.clusters.forget')}
                    </Button>
                  )}
                </>
              }
            />
            {check.isError && check.variables === cluster.id && (
              <div className="mt-2">
                <ActionError error={check.error} />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-12 text-tx-2">
              {connection
                ? t('pipelines.clusters.none')
                : t('pipelines.clusters.needsProject', { env: environment.name })}
            </span>
            {connection && (
              <Button size="sm" variant="secondary" className="ms-auto" onClick={onAdd}>
                <Icon name="plus" size={14} />
                {connection.mode === 'attached'
                  ? t('pipelines.clusters.attach')
                  : t('pipelines.clusters.create')}
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
