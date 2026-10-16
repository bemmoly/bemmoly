import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunSummary } from '@bemmoly/module-pipelines/shared';
import { Avatar, RelativeTime, Table, TableSkeleton, type TableColumn } from '@bemmoly/ui';
import type { ReactNode } from 'react';
import { pipelinesText } from '../../i18n/catalog.ts';
import { formatSpan } from '../../lib/format.ts';
import { StateGlyph } from '../../parts/bits.tsx';
import { runGlyph, useRunWhere } from '../../parts/run-line.tsx';

export const RUN_ROW = 52;
const scroller = () => document.getElementById('content');

function useColumns(showApplication: boolean): TableColumn<RunSummary>[] {
  const t = useT(pipelinesText);
  const where = useRunWhere();
  return [
    {
      key: 'state',
      header: <span className="sr-only">{t('pipelines.runs.column.state')}</span>,
      width: '20px',
      render: (run) => <StateGlyph state={runGlyph(run.state)} />,
    },
    {
      key: 'run',
      header: t('pipelines.runs.column.run'),
      width: 'minmax(0,2fr)',
      render: (run) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{run.title}</span>
          <span className="truncate text-12 text-tx-3">
            {[
              t('pipelines.run.number', { number: formatNumber(run.number) }),
              showApplication ? run.applications.map((app) => app.name).join(', ') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </span>
      ),
    },
    {
      key: 'where',
      header: t('pipelines.runs.column.where'),
      width: 'minmax(0,1.2fr)',
      hideOnPhone: true,
      render: (run) => (
        <span className="block truncate font-mono text-12 text-tx-2">{where(run)}</span>
      ),
    },
    {
      key: 'trigger',
      header: t('pipelines.runs.column.trigger'),
      width: '110px',
      hideOnPhone: true,
      render: (run) => (
        <span className="text-12 text-tx-2">{t(`pipelines.trigger.${run.trigger}`)}</span>
      ),
    },
    {
      key: 'author',
      header: t('pipelines.runs.column.author'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (run) => {
        const name = run.author?.name ?? run.authorLogin;
        return name ? (
          <span className="flex min-w-0 items-center gap-2 text-12 text-tx-2">
            <Avatar name={name} size={18} />
            <span className="truncate">{name}</span>
          </span>
        ) : null;
      },
    },
    {
      key: 'duration',
      header: t('pipelines.runs.column.duration'),
      width: '80px',
      align: 'end',
      render: (run) =>
        text(
          run.durationSeconds !== null
            ? formatSpan(run.durationSeconds)
            : t(`pipelines.runState.${run.state}`),
        ),
    },
    {
      key: 'started',
      header: t('pipelines.runs.column.started'),
      width: '96px',
      align: 'end',
      hideOnPhone: true,
      render: (run) => <RelativeTime iso={run.createdAt} className="text-12 text-tx-3" />,
    },
  ];
}

const text = (value: ReactNode) => <span className="text-12 text-tx-2 tabular-nums">{value}</span>;

export function RunsTable({
  runs,
  showApplication,
  onOpen,
  onEndReached,
  empty,
}: {
  runs: readonly RunSummary[];
  showApplication: boolean;
  onOpen: (run: RunSummary) => void;
  onEndReached: () => void;
  empty: ReactNode;
}) {
  const t = useT(pipelinesText);
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <Table
        label={t('pipelines.runs.tableLabel')}
        columns={useColumns(showApplication)}
        rows={runs}
        rowKey={(run) => run.id}
        onRowClick={onOpen}
        virtual={{ getScrollElement: scroller, rowHeight: RUN_ROW }}
        onEndReached={onEndReached}
        empty={empty}
      />
    </div>
  );
}

export function RunsTableSkeleton({ showApplication }: { showApplication: boolean }) {
  const t = useT(pipelinesText);
  return (
    <div className="rounded-card border border-line bg-card shadow-e1">
      <TableSkeleton
        label={t('pipelines.runs.loading')}
        columns={useColumns(showApplication)}
        rows={10}
      />
    </div>
  );
}
