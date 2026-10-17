import { formatDate, useT } from '@bemmoly/core-web';
import type { Promotion } from '@bemmoly/module-pipelines/shared';
import { Button, RelativeTime, RunGlyph, Table, type TableColumn } from '@bemmoly/ui';
import { useGo } from '../../hooks/use-go.ts';
import { pipelinesText } from '../../i18n/catalog.ts';
import { approvalsOf, gatesMet, promotionPath } from '../../parts/promotion-state.ts';
import { TierChip } from '../../parts/tier-chip.tsx';

/**
 * The approvals this person can give now, each with how far its gates and approvals have got,
 * who asked and when it expires. Enter or Review opens the Promote screen on it.
 */
export function Waiting({ items }: { items: readonly Promotion[] }) {
  const t = useT(pipelinesText);
  const go = useGo();
  const open = (promotion: Promotion) => go(promotionPath(promotion));
  const columns: TableColumn<Promotion>[] = [
    {
      key: 'what',
      header: t('pipelines.releases.colApplication'),
      width: 'minmax(0,1.6fr)',
      render: (promotion) => (
        <span className="flex min-w-0 items-center gap-2">
          <RunGlyph state="waiting" size={14} />
          <span className="flex min-w-0 flex-col leading-card">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium text-tx">{promotion.application.name}</span>
              <TierChip tier={promotion.application.tier} />
            </span>
            <span className="truncate text-12 text-tx-2">
              {t('pipelines.releases.toEnvironment', {
                version: promotion.release.version,
                environment: promotion.environment.name,
              })}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'progress',
      header: t('pipelines.releases.colState'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (promotion) => {
        const gates = gatesMet(promotion);
        const approvals = approvalsOf(promotion);
        return (
          <span className="flex flex-col text-12 leading-card">
            <span className={gates.failing ? 'text-red-tx' : 'text-tx-2'}>
              {t('pipelines.releases.gatesMet', { met: gates.met, total: gates.total })}
            </span>
            <span className="text-tx-3">{t('pipelines.releases.approvalsGiven', approvals)}</span>
          </span>
        );
      },
    },
    {
      key: 'who',
      header: t('pipelines.releases.colWho'),
      width: 'minmax(0,1fr)',
      hideOnPhone: true,
      render: (promotion) => (
        <span className="flex flex-col text-12 leading-card">
          <span className="truncate text-tx-2">
            {promotion.requestedBy?.name ?? t('pipelines.releases.automatic')}
          </span>
          <span className="text-tx-3">
            <RelativeTime iso={promotion.createdAt} />
            {promotion.expiresAt &&
              ` · ${t('pipelines.releases.expires', {
                time: formatDate(promotion.expiresAt, { hour: '2-digit', minute: '2-digit' }),
              })}`}
          </span>
        </span>
      ),
    },
    {
      key: 'review',
      header: '',
      width: '84px',
      align: 'end',
      render: (promotion) => (
        <Button
          size="xs"
          variant="secondary"
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            open(promotion);
          }}
        >
          {t('pipelines.releases.review')}
        </Button>
      ),
    },
  ];
  return (
    <Table
      label={t('pipelines.releases.waitingLabel')}
      columns={columns}
      rows={items}
      rowKey={(promotion) => promotion.id}
      onRowClick={open}
    />
  );
}
