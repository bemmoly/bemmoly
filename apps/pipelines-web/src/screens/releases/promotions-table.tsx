import { useT } from '@bemmoly/core-web';
import type { Promotion } from '@bemmoly/module-pipelines/shared';
import { EmptyState, RelativeTime, RunGlyph, Table, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { usePromotions } from '../../hooks/use-shipping.ts';
import { useGo } from '../../hooks/use-go.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { LoadFailed } from '../../parts/load-failed.tsx';
import { PROMOTION_GLYPH, promotionPath } from '../../parts/promotion-state.ts';
import { RowsSkeleton } from '../../parts/rows-skeleton.tsx';
import { TierChip } from '../../parts/tier-chip.tsx';

/** Every promotion in the scope, newest first, with its state; a row opens it. */
export function PromotionsTable({ scope, scopeName }: { scope: string; scopeName: string }) {
  const t = useT(pipelinesText);
  const go = useGo();
  const promotions = usePromotions({ scope: scope || undefined });
  if (promotions.isError && !promotions.data) {
    return (
      <LoadFailed
        bare
        size="sm"
        className="m-3"
        error={promotions.error}
        onRetry={() => void promotions.refetch()}
      />
    );
  }
  if (!promotions.data) return <RowsSkeleton columns={5} rows={8} />;
  const rows = promotions.data.pages.flatMap((page) => page.items);
  const columns: TableColumn<Promotion>[] = [
    {
      key: 'application',
      header: t('pipelines.releases.colApplication'),
      width: 'minmax(0,1.4fr)',
      render: (promotion) => (
        <span className="flex min-w-0 items-center gap-2">
          <RunGlyph state={PROMOTION_GLYPH[promotion.state]} size={14} />
          <span className="truncate font-medium text-tx">{promotion.application.name}</span>
          <TierChip tier={promotion.application.tier} />
        </span>
      ),
    },
    {
      key: 'release',
      header: t('pipelines.releases.colRelease'),
      width: 'minmax(0,0.8fr)',
      render: (promotion) => (
        <span className="truncate font-mono text-12 text-tx-2">{promotion.release.version}</span>
      ),
    },
    {
      key: 'to',
      header: t('pipelines.releases.colTo'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (promotion) => (
        <span className="truncate text-12 text-tx-2">{promotion.environment.name}</span>
      ),
    },
    {
      key: 'state',
      header: t('pipelines.releases.colState'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (promotion) => (
        <span className="flex min-w-0 flex-col text-12 leading-card">
          <span className="truncate text-tx">
            {t(`pipelines.promotionState.${promotion.state}`)}
          </span>
          {promotion.departure && (
            <span className="truncate text-tx-3">
              {t('pipelines.releases.onTrain', { train: promotion.departure.trainName })}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'when',
      header: t('pipelines.releases.colWhen'),
      width: 'minmax(0,0.8fr)',
      align: 'end',
      render: (promotion) => (
        <span className="text-12 text-tx-3">
          <RelativeTime iso={promotion.createdAt} />
        </span>
      ),
    },
  ];
  return (
    <Table
      label={t('pipelines.releases.promotionsLabel', { scope: scopeName })}
      columns={columns}
      rows={rows}
      rowKey={(promotion) => promotion.id}
      onRowClick={(promotion) => go(promotionPath(promotion))}
      footer={{
        summary: t('pipelines.releases.shown', { count: rows.length }),
        hasMore: promotions.hasNextPage,
        loading: promotions.isFetchingNextPage,
        onLoadMore: () => void promotions.fetchNextPage(),
        loadMoreLabel: t('pipelines.releases.loadMore'),
      }}
      empty={
        <EmptyState
          size="sm"
          icon={<Icon name="rocket" size={18} />}
          title={t('pipelines.releases.promotionsEmpty', { scope: scopeName })}
        />
      }
    />
  );
}
