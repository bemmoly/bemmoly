import { useT } from '@bemmoly/core-web';
import {
  IconButton,
  Menu,
  MenuItem,
  RelativeTime,
  Table,
  Tag,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../../i18n/catalog.ts';
import type { VariableRow } from './rows.ts';
import { ValueCell } from './value-cell.tsx';

/**
 * One view's variables: name, value (or that a secret is set), version and who set it. Each
 * row's menu replaces, gives the environment its own value, or deletes.
 */
export function VariablesTable({
  rows,
  environmentName,
  canChange,
  saving,
  empty,
  onSave,
  onReplace,
  onOverride,
  onDelete,
}: {
  rows: readonly VariableRow[];
  /** The environment the view shows; null for every environment. */
  environmentName: string | null;
  canChange: boolean;
  saving: boolean;
  empty: ReactNode;
  onSave: (row: VariableRow, value: string) => void;
  onReplace: (row: VariableRow) => void;
  onOverride: (row: VariableRow) => void;
  onDelete: (row: VariableRow) => void;
}) {
  const t = useT(pipelinesText);
  const columns: TableColumn<VariableRow>[] = [
    {
      key: 'name',
      header: t('pipelines.variables.name'),
      width: 'minmax(0,1fr)',
      render: (row) => (
        <span className="flex min-w-0 flex-col leading-card">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-mono text-12 font-medium text-tx">{row.name}</span>
            {row.variable.kind === 'secret' && (
              <Tag size="sm">{t('pipelines.variables.kindSecret')}</Tag>
            )}
          </span>
          {row.inherited && (
            <span className="truncate text-11 text-tx-3">{t('pipelines.variables.inherited')}</span>
          )}
          {row.overrides && (
            <span className="truncate text-11 text-tx-3">{t('pipelines.variables.overrides')}</span>
          )}
        </span>
      ),
    },
    {
      key: 'value',
      header: t('pipelines.variables.value'),
      width: 'minmax(0,1.4fr)',
      render: (row) => (
        <ValueCell
          row={row}
          canChange={canChange}
          saving={saving}
          onSave={(value) => onSave(row, value)}
          onReplace={() => onReplace(row)}
        />
      ),
    },
    {
      key: 'version',
      header: t('pipelines.variables.version'),
      width: '72px',
      hideOnPhone: true,
      render: (row) =>
        row.variable.kind === 'secret' && row.variable.version !== null ? (
          <span className="font-mono text-12 text-tx-2">
            {t('pipelines.variables.versionShort', { version: row.variable.version })}
          </span>
        ) : null,
    },
    {
      key: 'by',
      header: t('pipelines.variables.setBy'),
      width: 'minmax(0,0.9fr)',
      hideOnPhone: true,
      render: (row) => (
        <span className="flex min-w-0 flex-col text-12 leading-card">
          <span className="truncate text-tx-2">
            {row.variable.updatedBy?.name ?? t('pipelines.variables.byPipelines')}
          </span>
          <span className="text-tx-3">
            <RelativeTime iso={row.variable.updatedAt} />
          </span>
        </span>
      ),
    },
  ];
  if (canChange) {
    columns.push({
      key: 'menu',
      header: '',
      width: '40px',
      align: 'end',
      reveal: true,
      render: (row) => (
        <Menu
          align="end"
          trigger={(props) => (
            <IconButton
              {...props}
              size="sm"
              variant="ghost"
              icon="more"
              label={t('pipelines.variables.rowMenu', { name: row.name })}
            />
          )}
        >
          {row.inherited && environmentName ? (
            <MenuItem icon={<Icon name="plus" size={14} />} onSelect={() => onOverride(row)}>
              {t('pipelines.variables.override', { environment: environmentName })}
            </MenuItem>
          ) : (
            <>
              {row.variable.kind === 'secret' && (
                <MenuItem icon={<Icon name="key" size={14} />} onSelect={() => onReplace(row)}>
                  {t('pipelines.variables.replace')}
                </MenuItem>
              )}
              <MenuItem
                tone="danger"
                icon={<Icon name="trash" size={14} />}
                onSelect={() => onDelete(row)}
              >
                {t('pipelines.variables.delete')}
              </MenuItem>
            </>
          )}
        </Menu>
      ),
    });
  }
  return (
    <Table
      label={t('pipelines.variables.tableLabel', {
        environment: environmentName ?? t('pipelines.variables.every'),
      })}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.name}
      empty={empty}
    />
  );
}
