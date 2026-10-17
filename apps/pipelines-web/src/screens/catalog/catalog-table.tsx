import { formatNumber, useT } from '@bemmoly/core-web';
import type { Application, ApplicationSort } from '@bemmoly/module-pipelines/shared';
import { DeliverySpark, Table, TableSkeleton, type TableColumn } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatAge, formatShare, formatSpan } from '../../lib/format.ts';
import { StateGlyph, TeamMark, TierBadge } from '../../parts/bits.tsx';

/** A row: name over group, so 52px holds both lines. */
export const CATALOG_ROW = 52;

const scroller = () => document.getElementById('content');

function useColumns(): TableColumn<Application>[] {
  const t = useT(pipelinesText);
  return [
    {
      key: 'name',
      header: t('pipelines.catalog.column.application'),
      width: 'minmax(0,1.6fr)',
      sortable: true,
      render: (app) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{app.name}</span>
          <span className="truncate text-12 text-tx-3">{app.group.name}</span>
        </span>
      ),
    },
    {
      key: 'owner',
      header: t('pipelines.catalog.column.owner'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (app) =>
        app.ownerTeam ? (
          <span className="flex min-w-0 items-center gap-2 text-12 text-tx-2">
            <TeamMark name={app.ownerTeam.name} />
            <span className="truncate">{app.ownerTeam.name}</span>
          </span>
        ) : (
          <span className="text-12 text-amber-tx">{t('pipelines.catalog.noOwner')}</span>
        ),
    },
    {
      key: 'tier',
      header: t('pipelines.catalog.column.tier'),
      width: '52px',
      sortable: true,
      hideOnPhone: true,
      render: (app) => <TierBadge tier={app.tier} />,
    },
    {
      key: 'recent',
      header: t('pipelines.catalog.column.prod'),
      width: '150px',
      sortable: true,
      render: (app) => <ProdCell app={app} />,
    },
    {
      key: 'deploys',
      header: t('pipelines.catalog.column.deploys'),
      width: '88px',
      hideOnPhone: true,
      render: (app) => {
        const total = app.delivery.deploysByWeek.reduce((sum, value) => sum + value, 0);
        return (
          <DeliverySpark
            values={app.delivery.deploysByWeek}
            label={t('pipelines.catalog.deploysLabel', { count: total })}
          />
        );
      },
    },
    {
      key: 'lead',
      header: t('pipelines.catalog.column.leadTime'),
      width: '84px',
      hideOnPhone: true,
      render: (app) =>
        cell(
          app.delivery.leadTimeSeconds === null
            ? t('pipelines.common.none')
            : formatSpan(app.delivery.leadTimeSeconds),
        ),
    },
    {
      key: 'cfr',
      header: t('pipelines.catalog.column.changeFailure'),
      width: '84px',
      hideOnPhone: true,
      render: (app) => {
        const rate = app.delivery.changeFailureRate;
        if (rate === null) return cell(t('pipelines.common.none'));
        return (
          <span className={`text-12 tabular-nums ${rate > 0.05 ? 'text-red-tx' : 'text-tx'}`}>
            {formatShare(rate)}
          </span>
        );
      },
    },
    {
      key: 'run',
      header: <span className="sr-only">{t('pipelines.catalog.column.lastRun')}</span>,
      width: '20px',
      render: (app) => (app.delivery.lastRun ? <StateGlyph state={app.delivery.lastRun} /> : null),
    },
  ];
}

const cell = (text: ReactNode) => <span className="text-12 text-tx tabular-nums">{text}</span>;

function ProdCell({ app }: { app: Application }) {
  const t = useT(pipelinesText);
  const { prodVersion, prodState, prodDeployedAt } = app.delivery;
  if (!prodVersion)
    return <span className="text-12 text-tx-3">{t('pipelines.catalog.notInProd')}</span>;
  const moving = prodState && prodState !== 'idle';
  return (
    <span className="flex min-w-0 items-baseline gap-2 text-12">
      <span className="truncate font-mono text-tx">{prodVersion}</span>
      <span className={moving ? 'text-acc' : 'text-tx-3'}>
        {moving
          ? t(`pipelines.current.${prodState}`)
          : prodDeployedAt
            ? formatAge(prodDeployedAt)
            : null}
      </span>
    </span>
  );
}

export function CatalogTable({
  rows,
  total,
  sort,
  onSort,
  onOpen,
  onEndReached,
  loadingMore,
  empty,
}: {
  rows: readonly Application[];
  total: number;
  sort: ApplicationSort;
  onSort: (sort: ApplicationSort) => void;
  onOpen: (app: Application) => void;
  onEndReached: () => void;
  loadingMore: boolean;
  empty: ReactNode;
}) {
  const t = useT(pipelinesText);
  const columns = useColumns();
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <Table
        label={t('pipelines.catalog.tableLabel')}
        columns={columns}
        rows={rows}
        rowKey={(app) => app.key}
        onRowClick={onOpen}
        sort={{ key: sort, direction: sort === 'recent' ? 'desc' : 'asc' }}
        onSort={(next) => onSort(next.key as ApplicationSort)}
        virtual={{ getScrollElement: scroller, rowHeight: CATALOG_ROW }}
        onEndReached={onEndReached}
        total={total}
        empty={empty}
      />
      {loadingMore || rows.length < total ? (
        <p className="px-3 py-2 text-12 text-tx-3 tabular-nums">
          {t('pipelines.catalog.showing', {
            shown: formatNumber(rows.length),
            total: formatNumber(total),
          })}
        </p>
      ) : null}
    </div>
  );
}

export function CatalogTableSkeleton() {
  const t = useT(pipelinesText);
  const columns = useColumns();
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <TableSkeleton label={t('pipelines.catalog.loading')} columns={columns} rows={10} />
    </div>
  );
}
