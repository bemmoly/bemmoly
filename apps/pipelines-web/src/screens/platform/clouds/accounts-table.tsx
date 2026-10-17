import { useT } from '@bemmoly/core-web';
import type { CloudAccount, CloudConnection } from '@bemmoly/module-pipelines/shared';
import {
  EntityTile,
  RunGlyph,
  Table,
  type EntityHue,
  type RunGlyphState,
  type TableColumn,
} from '@bemmoly/ui';
import { useCloudAccounts } from '../../../hooks/use-clouds.ts';
import { pipelinesText } from '../../../i18n/catalog.ts';
import { LoadFailed } from '../../../parts/load-failed.tsx';
import { RowsSkeleton } from '../../../parts/rows-skeleton.tsx';
import { Panel } from '../../../parts/screen.tsx';
import { unitOf } from './connection-card.tsx';

const GLYPH: Record<CloudAccount['status'], RunGlyphState> = {
  planned: 'queued',
  creating: 'running',
  ready: 'passed',
  drifted: 'waiting',
  failed: 'failed',
};

/** The cloud accounts (projects) a connection's landing zone made, by domain and environment. */
export function AccountsTable({ connection }: { connection: CloudConnection }) {
  const t = useT(pipelinesText);
  const accounts = useCloudAccounts(connection.id);
  const columns: TableColumn<CloudAccount>[] = [
    {
      key: 'name',
      header: t('pipelines.clouds.colAccount'),
      width: 'minmax(0,1.4fr)',
      render: (account) => (
        <span className="truncate font-mono text-12 text-tx">{account.name}</span>
      ),
    },
    {
      key: 'domain',
      header: t('pipelines.clouds.colDomain'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (account) =>
        account.domain ? (
          <span className="flex min-w-0 items-center gap-2">
            <EntityTile
              name={account.domain.name}
              hue={account.domain.color as EntityHue}
              size={16}
            />
            <span className="truncate text-12 text-tx">{account.domain.name}</span>
          </span>
        ) : (
          <span className="text-12 text-tx-3">{t('pipelines.clouds.shared')}</span>
        ),
    },
    {
      key: 'environment',
      header: t('pipelines.clouds.colEnvironment'),
      width: 'minmax(0,0.7fr)',
      render: (account) => (
        <span className="text-12 text-tx-2">
          {account.environmentClass
            ? t(`pipelines.envClass.${account.environmentClass}`)
            : t(`pipelines.clouds.purpose.${account.purpose}`)}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('pipelines.clouds.colStatus'),
      width: 'minmax(0,0.7fr)',
      render: (account) => (
        <span className="flex items-center gap-1.5 text-12 text-tx-2">
          <RunGlyph state={GLYPH[account.status]} size={14} />
          {t(`pipelines.clouds.accountStatus.${account.status}`)}
        </span>
      ),
    },
  ];
  return (
    <Panel
      flush
      title={t('pipelines.clouds.accounts', { unit: unitOf(connection.provider) })}
      meta={accounts.data && String(accounts.data.items.length)}
    >
      {accounts.isError ? (
        <LoadFailed bare size="sm" error={accounts.error} onRetry={() => void accounts.refetch()} />
      ) : !accounts.data ? (
        <RowsSkeleton columns={4} rows={6} />
      ) : (
        <Table
          label={t('pipelines.clouds.accountsLabel', { name: connection.name })}
          columns={columns}
          rows={accounts.data.items}
          rowKey={(account) => account.id}
          density="sm"
        />
      )}
    </Panel>
  );
}
