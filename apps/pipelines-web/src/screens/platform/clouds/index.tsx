import { useT } from '@bemmoly/core-web';
import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useArrivalCheck, useConnections } from '../../../hooks/use-clouds.ts';
import { useGo } from '../../../hooks/use-go.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { Area } from '../../../parts/area.tsx';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { AccountsTable } from './accounts-table.tsx';
import { AttachedCard } from './attached-card.tsx';
import { ConnectionCard } from './connection-card.tsx';

/**
 * Platform › Clouds: the clouds Pipelines deploys to and the accounts it made or was given in
 * each. ?connection= names one just connected: it is checked once on arrival.
 */
export default function CloudsArea() {
  const t = useT(pipelinesText);
  const go = useGo();
  const connections = useConnections();
  const arrival = useArrivalCheck();
  const connect = (
    <Button variant="primary" onClick={() => go({ to: '/platform/clouds/connect' })}>
      <Icon name="plus" size={14} />
      {t('pipelines.clouds.connect')}
    </Button>
  );
  const items = connections.data?.items ?? [];
  return (
    <Area
      title={t('pipelines.platform.clouds')}
      meta={t('pipelines.clouds.connectIntro')}
      actions={items.length ? connect : null}
    >
      {connections.isError ? (
        <LoadFailed error={connections.error} onRetry={() => void connections.refetch()} />
      ) : !connections.data ? (
        <RowsSkeleton columns={4} rows={6} />
      ) : items.length === 0 ? (
        <div className="rounded-card border border-line bg-card py-10">
          <EmptyState
            icon={<Icon name="cloud" size={18} />}
            title={t('pipelines.clouds.emptyTitle')}
            description={t('pipelines.clouds.emptyDescription')}
            headingLevel={2}
            action={connect}
          />
        </div>
      ) : (
        items.map((connection) =>
          connection.mode === 'attached' ? (
            <AttachedCard
              key={connection.id}
              connection={connection}
              arrived={arrival.connectionId === connection.id}
              checking={arrival.connectionId === connection.id && arrival.checking}
            />
          ) : (
            <div key={connection.id} className="flex flex-col gap-3">
              <ConnectionCard connection={connection} />
              <AccountsTable connection={connection} />
            </div>
          ),
        )
      )}
    </Area>
  );
}
