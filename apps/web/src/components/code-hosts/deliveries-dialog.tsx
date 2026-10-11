import type { CodeDeliveryOutcome, CodeHost } from '@bemmoly/shared';
import { Button, EmptyState, Modal, RelativeTime, SkeletonRow } from '@bemmoly/ui';
import { useCodeHostDeliveries } from '../../hooks/use-code-hosts.ts';
import { describeError } from '../../lib/errors.ts';
import { StatePill, type PillTone } from '../settings/state-pill.tsx';

const OUTCOMES: Record<CodeDeliveryOutcome, { tone: PillTone; label: string }> = {
  processed: { tone: 'ok', label: 'Applied' },
  ignored: { tone: 'neutral', label: 'Not used' },
  failed: { tone: 'red', label: 'Failed' },
  test: { tone: 'acc', label: 'Test' },
};

/**
 * The host's last twenty deliveries: what each said, and what came of it. A refused
 * signature is not listed (it is never stored); the card says when one arrived.
 */
export function DeliveriesDialog({ host, onClose }: { host: CodeHost; onClose: () => void }) {
  const deliveries = useCodeHostDeliveries(host.id);
  const items = deliveries.data ?? [];
  return (
    <Modal
      open
      width="lg"
      onClose={onClose}
      title={`Recent deliveries · ${host.name}`}
      description="The last twenty, newest first. Deliveries older than 30 days leave the log."
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {deliveries.isPending && (
        <div aria-busy className="flex flex-col">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}
      {deliveries.isError && (
        <EmptyState
          title="Deliveries did not load"
          description={describeError(deliveries.error).message}
          action={<Button onClick={() => void deliveries.refetch()}>Try again</Button>}
        />
      )}
      {deliveries.isSuccess && items.length === 0 && (
        <EmptyState
          title="Nothing received yet"
          description="Add the webhook in the host, then send a test delivery from the card."
        />
      )}
      {items.length > 0 && (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-2 p-0">
          {items.map((delivery) => {
            const outcome = OUTCOMES[delivery.outcome];
            return (
              <li key={delivery.id} className="flex flex-col gap-1 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <StatePill tone={outcome.tone}>{outcome.label}</StatePill>
                  <span className="min-w-0 flex-1 truncate text-13 text-tx">
                    {delivery.summary || delivery.event}
                  </span>
                  <span className="shrink-0 text-12 text-tx-3">
                    <RelativeTime iso={delivery.receivedAt} />
                  </span>
                </div>
                {delivery.error && (
                  <p className="m-0 text-12 break-words text-red-tx">{delivery.error}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
