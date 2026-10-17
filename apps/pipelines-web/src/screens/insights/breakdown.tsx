import { formatNumber, useT } from '@bemmoly/core-web';
import type { InsightsRow } from '@bemmoly/module-pipelines/shared';
import { EmptyState, EntityTile, Table, type EntityHue, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatMeasure } from './format.ts';

const NAME = {
  domain: 'pipelines.insights.rowDomain',
  group: 'pipelines.insights.rowGroup',
  team: 'pipelines.insights.rowTeam',
} as const;

/**
 * One row per domain, group or owning team with the same four measures, busiest first.
 * Domains and groups open their own Insights; teams stay a row.
 */
export function Breakdown({
  rows,
  level,
  onOpen,
}: {
  rows: readonly InsightsRow[];
  level: InsightsRow['kind'];
  onOpen: (row: InsightsRow) => void;
}) {
  const t = useT(pipelinesText);
  const dash = t('pipelines.insights.none');
  const measure = (value: number | null, render: (value: number) => string) => (
    <span className="font-mono text-12 text-tx-2 tabular-nums">
      {value === null ? dash : render(value)}
    </span>
  );
  const columns: TableColumn<InsightsRow>[] = [
    {
      key: 'name',
      header: t(NAME[level]),
      width: 'minmax(0,1.6fr)',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2">
          {row.kind !== 'team' && (
            <EntityTile
              name={row.name}
              {...(row.color ? { hue: row.color as EntityHue } : {})}
              size={18}
            />
          )}
          <span className="truncate font-medium text-tx">{row.name}</span>
        </span>
      ),
    },
    {
      key: 'applications',
      header: t('pipelines.insights.applications'),
      width: 'minmax(80px,0.7fr)',
      align: 'end',
      hideOnPhone: true,
      render: (row) => measure(row.applications, (value) => formatNumber(value)),
    },
    {
      key: 'deploys',
      header: t('pipelines.insights.deploysADay'),
      width: 'minmax(80px,0.8fr)',
      align: 'end',
      render: (row) =>
        measure(row.deploysPerDay, (value) => formatMeasure('deployFrequency', value)),
    },
    {
      key: 'lead',
      header: t('pipelines.insights.leadTimeShort'),
      width: 'minmax(80px,0.8fr)',
      align: 'end',
      render: (row) => measure(row.leadTimeSeconds, (value) => formatMeasure('leadTime', value)),
    },
    {
      key: 'failure',
      header: t('pipelines.insights.changeFailureShort'),
      width: 'minmax(80px,0.8fr)',
      align: 'end',
      hideOnPhone: true,
      render: (row) =>
        measure(row.changeFailureRate, (value) => formatMeasure('changeFailureRate', value)),
    },
    {
      key: 'restore',
      header: t('pipelines.insights.restoreShort'),
      width: 'minmax(80px,0.8fr)',
      align: 'end',
      hideOnPhone: true,
      render: (row) =>
        measure(row.timeToRestoreSeconds, (value) => formatMeasure('timeToRestore', value)),
    },
  ];
  return (
    <Table
      label={t('pipelines.insights.breakdownLabel')}
      columns={columns}
      rows={rows}
      rowKey={(row) => `${row.kind}:${row.key}`}
      {...(level === 'team' ? {} : { onRowClick: onOpen })}
      empty={
        <EmptyState
          size="sm"
          icon={<Icon name="reports" size={18} />}
          title={t('pipelines.insights.emptyTitle')}
          description={t('pipelines.insights.emptyDescription')}
        />
      }
    />
  );
}
