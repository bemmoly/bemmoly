import { useT } from '@bemmoly/core-web';
import type { CloudConnection, Cluster, Environment } from '@bemmoly/module-pipelines/shared';
import { ConfirmChange, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useState } from 'react';
import { useAllCloudAccounts } from '../../../hooks/use-clouds.ts';
import { useEnvironments } from '../../../hooks/use-environments.ts';
import { useClusters, useClusterWrites } from '../../../hooks/use-runtimes.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { ActionError } from '../../../parts/action-error.tsx';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { ClusterDialog } from './cluster-dialog.tsx';
import { EnvironmentRow } from './environment-row.tsx';

/**
 * Platform › Clusters: each environment and its one cluster, made only when an application
 * there runs on GKE. A managed connection creates it; an attached one attaches a cluster that
 * exists and is only ever deployed into. A cluster being created is checked on until it runs.
 */
export default function ClustersArea() {
  const t = useT(pipelinesText);
  const environments = useEnvironments();
  const clusters = useClusters();
  const clouds = useAllCloudAccounts();
  const { remove } = useClusterWrites();
  const [adding, setAdding] = useState<{
    environment: Environment;
    connection: CloudConnection;
  } | null>(null);
  const [forgetting, setForgetting] = useState<Cluster | null>(null);
  const connectionOf = (environment: Environment) =>
    clouds.items.find(({ accounts }) =>
      accounts.some((account) => account.id === environment.cloudAccount?.id),
    )?.connection ?? null;
  const items = environments.data?.items ?? [];
  const error = environments.error ?? clusters.error;
  const closeForget = () => {
    remove.reset();
    setForgetting(null);
  };
  return (
    <Area title={t('pipelines.platform.clusters')} meta={t('pipelines.clusters.intro')}>
      {error ? (
        <LoadFailed
          error={error}
          onRetry={() => void Promise.all([environments.refetch(), clusters.refetch()])}
        />
      ) : !environments.data || !clusters.data ? (
        <RowsSkeleton columns={3} rows={4} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-line bg-card py-10">
          <EmptyState
            icon={<Icon name="hexagon" size={18} />}
            title={t('pipelines.clusters.emptyTitle')}
            description={t('pipelines.clusters.emptyDescription')}
            headingLevel={2}
          />
        </div>
      ) : (
        <Panel flush title={t('pipelines.clusters.byEnvironment')} meta={String(items.length)}>
          <ul aria-label={t('pipelines.clusters.listLabel')}>
            {items.map((environment) => {
              const connection = connectionOf(environment);
              return (
                <EnvironmentRow
                  key={environment.id}
                  environment={environment}
                  cluster={clusters.data.items.find((c) => c.environment.id === environment.id)}
                  connection={connection}
                  onAdd={() => connection && setAdding({ environment, connection })}
                  onForget={setForgetting}
                />
              );
            })}
          </ul>
        </Panel>
      )}
      {adding && (
        <ClusterDialog
          environment={adding.environment}
          connection={adding.connection}
          open
          onClose={() => setAdding(null)}
        />
      )}
      <ConfirmChange
        open={forgetting !== null}
        title={t('pipelines.clusters.forgetTitle', { name: forgetting?.name ?? '' })}
        consequences={[
          t('pipelines.clusters.forgetStops', { env: forgetting?.environment.name ?? '' }),
          t('pipelines.clusters.forgetKeeps'),
        ]}
        confirmLabel={t('pipelines.clusters.forgetConfirm')}
        busy={remove.isPending}
        error={<ActionError error={remove.error} />}
        onCancel={closeForget}
        onConfirm={() => forgetting && remove.mutate(forgetting.id, { onSuccess: closeForget })}
      />
    </Area>
  );
}
