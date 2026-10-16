import { useT } from '@bemmoly/core-web';
import type { Environment } from '@bemmoly/module-pipelines/shared';
import { Table, Tag, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';

/** Every environment left to right: its cloud, region and what it asks of a deploy. */
export function EnvironmentsTable({ items }: { items: readonly Environment[] }) {
  const t = useT(pipelinesText);
  const columns: TableColumn<Environment>[] = [
    {
      key: 'name',
      header: t('pipelines.environments.name'),
      width: 'minmax(0,1.2fr)',
      render: (env) => (
        <span className="flex min-w-0 flex-col leading-card">
          <span className="truncate font-medium text-tx">{env.name}</span>
          <span className="truncate font-mono text-11 text-tx-3">{env.key}</span>
        </span>
      ),
    },
    {
      key: 'cloud',
      header: t('pipelines.environments.cloud'),
      width: 'minmax(0,1.2fr)',
      hideOnPhone: true,
      render: (env) => (
        <span className="flex min-w-0 flex-col text-12 leading-card">
          <span className="truncate text-tx-2">
            {[t(`pipelines.provider.${env.provider}`), env.region].filter(Boolean).join(' · ')}
          </span>
          {env.cloudAccount && (
            <span className="truncate font-mono text-11 text-tx-3">{env.cloudAccount.name}</span>
          )}
        </span>
      ),
    },
    {
      key: 'protection',
      header: t('pipelines.environments.protection'),
      width: 'minmax(0,1.6fr)',
      render: (env) => (
        <span className="flex flex-wrap items-center gap-1">
          {env.protection.protected ? (
            <Tag size="sm">
              <Icon name="shield" size={12} />
              {t('pipelines.environments.protected')}
            </Tag>
          ) : (
            <span className="text-12 text-tx-3">{t('pipelines.environments.open')}</span>
          )}
          {env.protection.requiresApproval && (
            <Tag size="sm">{t('pipelines.environments.approval')}</Tag>
          )}
          {env.protection.controlPlaneOnly && (
            <Tag size="sm">{t('pipelines.environments.controlPlane')}</Tag>
          )}
          {env.protection.window && (
            <span className="text-12 text-tx-3">
              {t('pipelines.environments.window', { window: env.protection.window })}
            </span>
          )}
        </span>
      ),
    },
  ];
  return (
    <Table
      label={t('pipelines.platform.environments')}
      columns={columns}
      rows={[...items].sort((a, b) => a.position - b.position)}
      rowKey={(env) => env.id}
    />
  );
}
