import { formatDate, useT } from '@bemmoly/core-web';
import type { ChangeItem, ChangeKind } from '@bemmoly/module-pipelines/shared';
import { Button, EmptyState, Table, usePhoneWidth, type TableColumn } from '@bemmoly/ui';
import { Icon, type IconName } from '@bemmoly/ui/icons';
import { pipelinesText } from '../../i18n/catalog.ts';

const KIND_ICON: Record<ChangeKind, IconName> = {
  deploy: 'rocket',
  rollback: 'undo',
  config: 'gear',
  environment: 'layers',
  access: 'lock',
  policy: 'shield',
  infrastructure: 'cloud',
};

/** A change that can be undone from here: a deploy, by rolling its deployment back. */
export function canRollBack(item: ChangeItem): boolean {
  return item.revertible && item.kind === 'deploy' && item.ref?.kind === 'deployment';
}

/**
 * Every change in the window, newest first: when, what kind, what it was and who did it, the
 * ones that landed just before the rise flagged, and Roll back where one is possible.
 */
export function ChangesList({
  items,
  onRollBack,
  onFocus,
}: {
  items: readonly ChangeItem[];
  onRollBack: (item: ChangeItem) => void;
  onFocus: (item: ChangeItem) => void;
}) {
  const t = useT(pipelinesText);
  const phone = usePhoneWidth();
  const time = (item: ChangeItem) =>
    formatDate(item.occurredAt, { hour: '2-digit', minute: '2-digit' });
  const columns: TableColumn<ChangeItem>[] = [
    {
      key: 'time',
      header: t('pipelines.changes.colTime'),
      width: '72px',
      hideOnPhone: true,
      render: (item) => <span className="font-mono text-12 text-tx-3">{time(item)}</span>,
    },
    {
      key: 'what',
      header: t('pipelines.changes.colWhat'),
      width: 'minmax(0,1fr)',
      render: (item) => (
        <span className="flex min-w-0 items-start gap-2.5">
          <Icon name={KIND_ICON[item.kind]} size={14} className="mt-0.5 shrink-0 text-tx-3" />
          <span className="flex min-w-0 flex-col leading-card">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="sr-only">{t(`pipelines.changeKind.${item.kind}`)}</span>
              <span className="truncate font-medium text-tx">{item.summary}</span>
              {item.beforeRiseMinutes !== null && (
                <span className="rounded-chip bg-amber-50 px-1.5 py-px text-11 font-medium whitespace-nowrap text-amber-tx">
                  {t('pipelines.changes.beforeRise', { minutes: item.beforeRiseMinutes })}
                </span>
              )}
            </span>
            {(item.detail || phone) && (
              <span className="truncate text-12 text-tx-3">
                {phone ? [time(item), item.detail].filter(Boolean).join(' · ') : item.detail}
              </span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'who',
      header: t('pipelines.changes.colWho'),
      width: 'minmax(0,140px)',
      hideOnPhone: true,
      render: (item) => (
        <span className="truncate text-12 text-tx-2">
          {item.actor?.name ?? item.actorLabel ?? t('pipelines.releases.automatic')}
        </span>
      ),
    },
    {
      key: 'action',
      header: '',
      width: phone ? '44px' : '112px',
      align: 'end',
      render: (item) =>
        canRollBack(item) ? (
          <Button
            size="xs"
            variant="secondary"
            tabIndex={-1}
            onClick={(event) => {
              event.stopPropagation();
              onRollBack(item);
            }}
          >
            <Icon name="undo" size={14} />
            <span className="max-md:sr-only">{t('pipelines.changes.rollBack')}</span>
          </Button>
        ) : null,
    },
  ];
  return (
    <Table
      label={t('pipelines.changes.listLabel')}
      columns={columns}
      rows={items}
      rowKey={(item) => item.id}
      onRowClick={onFocus}
      rowProps={(item) => ({ onFocus: () => onFocus(item) })}
      empty={
        <EmptyState
          size="sm"
          icon={<Icon name="pulse" size={18} />}
          title={t('pipelines.changes.emptyTitle')}
          description={t('pipelines.changes.emptyDescription')}
        />
      }
    />
  );
}
