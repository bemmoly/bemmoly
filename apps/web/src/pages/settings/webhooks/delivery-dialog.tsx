import type { WebhookDelivery } from '@bemmoly/shared/webhooks';
import {
  Button,
  formatAbsolute,
  Modal,
  RelativeTime,
  SettingsValue,
  SettingsValues,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { StatePill } from '../../../components/settings/state-pill.tsx';
import {
  attemptLabel,
  deliveryLook,
  durationLabel,
  eventLabel,
} from '../../../hooks/use-webhooks.ts';

interface DeliveryDialogProps {
  delivery: WebhookDelivery | null;
  busy: boolean;
  onRedeliver: (delivery: WebhookDelivery) => void;
  onClose: () => void;
}

/** One delivery in full: what went, what came back, and when it tries again. */
export function DeliveryDialog({ delivery, busy, onRedeliver, onClose }: DeliveryDialogProps) {
  const look = delivery ? deliveryLook(delivery) : null;
  return (
    <Modal
      open={delivery !== null}
      onClose={onClose}
      width="lg"
      title="Delivery details"
      description={
        delivery
          ? `${eventLabel(delivery.event)} · ${formatAbsolute(delivery.createdAt)}`
          : undefined
      }
      footer={
        delivery ? (
          <>
            <Button onClick={onClose}>Close</Button>
            <Button
              variant="primary"
              icon={<Icon name="refresh" />}
              loading={busy}
              onClick={() => onRedeliver(delivery)}
            >
              Redeliver
            </Button>
          </>
        ) : null
      }
    >
      {delivery && look ? (
        <div className="flex flex-col gap-4">
          <SettingsValues>
            <SettingsValue label="State">
              <span className="flex items-center gap-2">
                <StatePill tone={look.tone}>{look.label}</StatePill>
                {delivery.nextAttemptAt ? (
                  <span className="text-12 font-normal text-tx-3">
                    Tries again <RelativeTime iso={delivery.nextAttemptAt} />
                  </span>
                ) : null}
              </span>
            </SettingsValue>
            <SettingsValue label="Attempt">{attemptLabel(delivery)}</SettingsValue>
            <SettingsValue label="Response" muted={delivery.responseStatus === null}>
              {delivery.responseStatus ?? 'No answer'}
            </SettingsValue>
            <SettingsValue label="Duration" muted={delivery.durationMs === null}>
              {durationLabel(delivery.durationMs) ?? 'Not sent yet'}
            </SettingsValue>
            <SettingsValue label="Event" mono>
              {delivery.event}
            </SettingsValue>
            <SettingsValue label="Delivery id" mono hint="Sent in the bemmoly-delivery header.">
              {delivery.id}
            </SettingsValue>
            {delivery.redeliveryOf ? (
              <SettingsValue label="Redelivery of" mono>
                {delivery.redeliveryOf}
              </SettingsValue>
            ) : null}
          </SettingsValues>
          {delivery.error ? (
            <p role="alert" className="m-0 rounded-control bg-red-50 px-3 py-2 text-13 text-red-tx">
              {delivery.error}
            </p>
          ) : null}
          <div className="flex flex-col gap-1.5">
            <span className="text-13 font-medium text-tx">What the receiver answered</span>
            {delivery.responseExcerpt ? (
              <pre className="m-0 max-h-60 overflow-auto rounded-control border border-line bg-sunken px-3 py-2 font-mono text-12 leading-body break-all whitespace-pre-wrap text-tx-2">
                {delivery.responseExcerpt}
              </pre>
            ) : (
              <span className="text-13 text-tx-3">Nothing came back.</span>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
