import type { WebhookDelivery } from '@bemmoly/shared/webhooks';
import {
  Button,
  EmptyState,
  formatAbsolute,
  IconButton,
  RelativeTime,
  SegmentedControl,
  SettingsSection,
  Table,
  type TableColumn,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { StatePill } from '../../../components/settings/state-pill.tsx';
import type {
  DeliveryFilter,
  useWebhookDeliveries,
} from '../../../hooks/use-webhook-deliveries.ts';
import {
  attemptLabel,
  deliveryLook,
  durationLabel,
  eventLabel,
} from '../../../hooks/use-webhooks.ts';
import { DeliveryDialog } from './delivery-dialog.tsx';
import { TableLoading } from './webhooks-states.tsx';

const WIDTHS = ['104px', 'minmax(0,1.4fr)', '72px', '80px', '80px', '96px', '32px'];

const FILTERS: { value: DeliveryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'succeeded', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'retrying', label: 'Retrying' },
  { value: 'pending', label: 'Queued' },
];

const DASH = <span className="text-tx-3">None</span>;

interface DeliveriesProps {
  log: ReturnType<typeof useWebhookDeliveries>;
  onTest: () => void;
  testing: boolean;
}

/** The delivery log: filter by state, Redeliver any row, open one for the receiver's answer. */
export function DeliveriesSection({ log, onTest, testing }: DeliveriesProps) {
  const redeliver = (delivery: WebhookDelivery) => log.redeliver.mutate(delivery);
  const columns: TableColumn<WebhookDelivery>[] = [
    {
      key: 'state',
      header: 'State',
      width: WIDTHS[0]!,
      render: (delivery) => {
        const look = deliveryLook(delivery);
        return <StatePill tone={look.tone}>{look.label}</StatePill>;
      },
    },
    {
      key: 'event',
      header: 'Event',
      width: WIDTHS[1]!,
      render: (delivery) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-tx">{eventLabel(delivery.event)}</span>
          {delivery.error ? (
            <span className="truncate text-12 text-red-tx">{delivery.error}</span>
          ) : null}
        </span>
      ),
    },
    {
      key: 'attempt',
      header: 'Attempt',
      width: WIDTHS[2]!,
      hideOnPhone: true,
      render: (delivery) => <span className="tabular-nums">{attemptLabel(delivery)}</span>,
    },
    {
      key: 'response',
      header: 'Response',
      width: WIDTHS[3]!,
      hideOnPhone: true,
      render: (delivery) =>
        delivery.responseStatus === null ? (
          DASH
        ) : (
          <span className="font-mono text-12 tabular-nums">{delivery.responseStatus}</span>
        ),
    },
    {
      key: 'duration',
      header: 'Duration',
      width: WIDTHS[4]!,
      hideOnPhone: true,
      render: (delivery) => (
        <span className="text-tx-2 tabular-nums">{durationLabel(delivery.durationMs) ?? ''}</span>
      ),
    },
    {
      key: 'when',
      header: 'When',
      width: WIDTHS[5]!,
      hideOnPhone: true,
      render: (delivery) => <RelativeTime iso={delivery.createdAt} className="text-tx-2" />,
    },
    {
      key: 'redeliver',
      header: <span className="sr-only">Redeliver</span>,
      width: WIDTHS[6]!,
      align: 'end',
      render: (delivery) => (
        <IconButton
          icon="refresh"
          size="sm"
          label={`Redeliver ${eventLabel(delivery.event)} from ${formatAbsolute(delivery.createdAt)}`}
          tip="Redeliver"
          onClick={(event) => {
            event.stopPropagation();
            redeliver(delivery);
          }}
        />
      ),
    },
  ];
  const filtered = log.status !== 'all';
  return (
    <SettingsSection
      title="Deliveries"
      layout="block"
      actions={
        <SegmentedControl
          size="sm"
          aria-label="Show deliveries"
          options={FILTERS}
          value={log.status}
          onChange={log.setStatus}
        />
      }
    >
      {log.log.isPending ? (
        <TableLoading label="Loading deliveries" widths={WIDTHS} />
      ) : (
        <Table
          label="Deliveries"
          columns={columns}
          rows={log.deliveries}
          rowKey={(delivery) => delivery.id}
          onRowClick={(delivery) => log.setOpen(delivery)}
          density="sm"
          footer={{
            hasMore: log.log.hasNextPage,
            loading: log.log.isFetchingNextPage,
            onLoadMore: () => void log.log.fetchNextPage(),
          }}
          empty={
            filtered ? (
              <EmptyState
                size="sm"
                title="No deliveries in this state"
                action={<Button onClick={() => log.setStatus('all')}>Clear filter</Button>}
              />
            ) : (
              <EmptyState
                size="sm"
                icon={<Icon name="clock" />}
                title="No deliveries yet"
                description="Send a test to see one here."
                action={
                  <Button loading={testing} onClick={onTest}>
                    Send test
                  </Button>
                }
              />
            )
          }
        />
      )}
      <DeliveryDialog
        delivery={log.open}
        busy={log.redeliver.isPending}
        onRedeliver={redeliver}
        onClose={() => log.setOpen(null)}
      />
    </SettingsSection>
  );
}
