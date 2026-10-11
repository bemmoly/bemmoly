import type { Webhook } from '@bemmoly/shared/webhooks';
import { RelativeTime, Table, type TableColumn } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import type { ReactNode } from 'react';
import { StatePill } from '../../../components/settings/state-pill.tsx';
import { eventsCount, formatLabel, urlHost, webhookLook } from '../../../hooks/use-webhooks.ts';
import { TableLoading } from './webhooks-states.tsx';

const WIDTHS = ['minmax(0,1.6fr)', '96px', 'minmax(0,1fr)', 'minmax(0,1.1fr)', '112px', '24px'];

const never = <span className="text-tx-3">Never</span>;

interface WebhooksTableProps {
  webhooks: readonly Webhook[];
  onOpen: (webhook: Webhook) => void;
  empty: ReactNode;
}

/** Every webhook: where it sends, what, in which shape, whether it is healthy, and when it last sent. */
export function WebhooksTable({ webhooks, onOpen, empty }: WebhooksTableProps) {
  const columns: TableColumn<Webhook>[] = [
    {
      key: 'name',
      header: 'Name',
      width: WIDTHS[0]!,
      render: (webhook) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{webhook.name}</span>
          <span className="truncate font-mono text-12 text-tx-3">{urlHost(webhook.url)}</span>
        </span>
      ),
    },
    {
      key: 'events',
      header: 'Events',
      width: WIDTHS[1]!,
      hideOnPhone: true,
      render: (webhook) => (
        <span className="tabular-nums">{eventsCount(webhook.events.length)}</span>
      ),
    },
    {
      key: 'format',
      header: 'Format',
      width: WIDTHS[2]!,
      hideOnPhone: true,
      render: (webhook) => <span className="block truncate">{formatLabel(webhook.format)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      width: WIDTHS[3]!,
      render: (webhook) => {
        const look = webhookLook(webhook);
        return (
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <StatePill tone={look.tone}>{look.label}</StatePill>
            {webhook.status === 'failing' && webhook.disabledReason ? (
              <span className="line-clamp-2 text-12 leading-card text-red-tx">
                {webhook.disabledReason}
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      key: 'last',
      header: 'Last delivery',
      width: WIDTHS[4]!,
      hideOnPhone: true,
      render: (webhook) =>
        webhook.lastDeliveryAt ? <RelativeTime iso={webhook.lastDeliveryAt} /> : never,
    },
    {
      key: 'open',
      header: <span className="sr-only">Open</span>,
      width: WIDTHS[5]!,
      align: 'end',
      render: () => <Icon name="chevron" className="text-tx-3" />,
    },
  ];
  return (
    <Table
      label="Webhooks"
      columns={columns}
      rows={webhooks}
      rowKey={(webhook) => webhook.id}
      onRowClick={onOpen}
      empty={empty}
    />
  );
}

export function WebhooksSkeleton() {
  return <TableLoading label="Loading webhooks" widths={WIDTHS} />;
}
