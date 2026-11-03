import { formatNumber, useT } from '@bemmoly/core-web';
import type { RunSummary } from '@bemmoly/module-pipelines/shared';
import { Badge, EmptyState, RelativeTime, Table, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { pipelinesText, servicesText } from '../../i18n/catalog.ts';
import { formatSpan } from '../../lib/format.ts';
import { StateGlyph } from '../../parts/bits.tsx';
import { LoadError } from '../../parts/load-error.tsx';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { runGlyph } from '../../parts/run-line.tsx';
import { CARD } from './card.ts';
import { useServiceKey, useServiceRuns } from './use-service.ts';

function useColumns(): TableColumn<RunSummary>[] {
  const t = useT(servicesText);
  const p = useT(pipelinesText);
  return [
    {
      key: 'run',
      header: t('pipelinesServices.runs.run'),
      width: 'minmax(220px,3fr)',
      render: (run) => (
        <span className="flex min-w-0 items-center gap-3">
          <StateGlyph state={runGlyph(run.state)} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-13 font-semibold text-tx">{run.title}</span>
            <span className="truncate text-12 text-tx-3">
              {[
                p('pipelines.run.number', { number: formatNumber(run.number) }),
                p(`pipelines.trigger.${run.trigger}`),
                run.author?.name ?? run.authorLogin,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'ref',
      header: t('pipelinesServices.runs.branch'),
      width: 'minmax(120px,1fr)',
      hideOnPhone: true,
      render: (run) => (
        <Badge className="inline-flex max-w-full items-center gap-1 truncate font-mono">
          <Icon name="branch" size={12} />
          {run.pullRequest ? p('pipelines.run.pullRequest', { number: run.pullRequest }) : run.ref}
        </Badge>
      ),
    },
    {
      key: 'took',
      header: t('pipelinesServices.runs.took'),
      width: '90px',
      hideOnPhone: true,
      render: (run) => (
        <span className="text-12 text-tx-2 tabular-nums">
          {run.durationSeconds !== null ? formatSpan(run.durationSeconds) : ''}
        </span>
      ),
    },
    {
      key: 'when',
      header: t('pipelinesServices.runs.when'),
      width: '110px',
      render: (run) => <RelativeTime iso={run.createdAt} className="text-12 text-tx-3" />,
    },
  ];
}

/** This service's runs, newest first: deliveries, promotions, tests and scripts. */
export default function ServiceRuns() {
  const t = useT(servicesText);
  const navigate = useNavigate();
  const key = useServiceKey();
  const runs = useServiceRuns(key);
  const columns = useColumns();
  return (
    <div className="mx-auto flex w-full max-w-360 flex-col gap-4 px-4 py-5 md:px-6">
      {runs.isError ? (
        <LoadError
          title={t('pipelinesServices.runs.loadFailed')}
          error={runs.error}
          onRetry={() => void runs.refetch()}
        />
      ) : !runs.data ? (
        <RowsSkeleton />
      ) : runs.data.items.length === 0 ? (
        <div className={CARD}>
          <EmptyState
            icon={<Icon name="play" size={18} />}
            title={t('pipelinesServices.runs.empty')}
          />
        </div>
      ) : (
        <Table
          label={t('pipelinesServices.tab.runs')}
          columns={columns}
          rows={runs.data.items}
          rowKey={(run) => run.id}
          onRowClick={(run) => void navigate({ to: '/runs/$id', params: { id: run.id } })}
        />
      )}
    </div>
  );
}
