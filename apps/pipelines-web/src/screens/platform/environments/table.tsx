import { useT } from '@bemmoly/core-web';
import type { Environment } from '@bemmoly/module-pipelines/shared';
import { IconButton, Menu, MenuItem, Table, Tag, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../../i18n/catalog.ts';

/**
 * Every environment left to right: its cloud, region and what it asks of a deploy. Edit,
 * Adopt services (once it has a project), Copy configuration and Archive sit in each row's
 * menu, shown on hover and focus.
 */
export function EnvironmentsTable({
  items,
  onEdit,
  onArchive,
  onAdopt,
  onCopy,
}: {
  items: readonly Environment[];
  onEdit?: (environment: Environment) => void;
  onArchive?: (environment: Environment) => void;
  onAdopt?: (environment: Environment) => void;
  onCopy?: (environment: Environment) => void;
}) {
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
  if (onEdit && onArchive) {
    columns.push({
      key: 'menu',
      header: '',
      width: '40px',
      align: 'end',
      reveal: true,
      render: (env) => (
        <Menu
          align="end"
          trigger={(props) => (
            <IconButton
              {...props}
              size="sm"
              variant="ghost"
              icon="more"
              label={t('pipelines.environments.rowMenu', { name: env.name })}
            />
          )}
        >
          <MenuItem icon={<Icon name="edit" size={14} />} onSelect={() => onEdit(env)}>
            {t('pipelines.environments.edit')}
          </MenuItem>
          {onAdopt && env.cloudAccount && (
            <MenuItem icon={<Icon name="import" size={14} />} onSelect={() => onAdopt(env)}>
              {t('pipelines.adopt.open')}
            </MenuItem>
          )}
          {onCopy && (
            <MenuItem icon={<Icon name="copy" size={14} />} onSelect={() => onCopy(env)}>
              {t('pipelines.copy.open')}
            </MenuItem>
          )}
          <MenuItem
            tone="danger"
            icon={<Icon name="archive" size={14} />}
            onSelect={() => onArchive(env)}
          >
            {t('pipelines.environments.archive')}
          </MenuItem>
        </Menu>
      ),
    });
  }
  return (
    <Table
      label={t('pipelines.platform.environments')}
      columns={columns}
      rows={[...items].sort((a, b) => a.position - b.position)}
      rowKey={(env) => env.id}
    />
  );
}
