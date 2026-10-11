import { WEBHOOK_AUTO_DISABLE_AFTER, type Webhook, type WebhookDelivery } from '@bemmoly/shared';
import {
  Button,
  IconButton,
  SettingsRow,
  SettingsSection,
  SettingsValue,
  SettingsValues,
  Switch,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { StatePill } from '../../../components/settings/state-pill.tsx';
import {
  deliveryLook,
  durationLabel,
  eventLabel,
  formatLabel,
} from '../../../hooks/use-webhooks.ts';
import { VerifyHint } from './webhook-secret.tsx';

interface FailingProps {
  webhook: Webhook;
  busy: boolean;
  onEnable: () => void;
}

/** The webhook turned itself off: why, in the receiver's words, and the way back. */
export function FailingBanner({ webhook, busy, onEnable }: FailingProps) {
  if (webhook.status !== 'failing') return null;
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-card bg-red-50 px-4 py-3 sm:flex-row sm:items-center"
    >
      <Icon name="warning" className="mt-0.5 shrink-0 text-red-tx sm:mt-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-red-tx">
        <span className="font-semibold">
          Turned off after {WEBHOOK_AUTO_DISABLE_AFTER} failed deliveries in a row
        </span>
        <span className="text-13 leading-body">
          {webhook.disabledReason ?? 'The receiver kept refusing deliveries.'} Fix the receiver,
          then turn the webhook back on.
        </span>
      </div>
      <Button loading={busy} onClick={onEnable}>
        Turn back on
      </Button>
    </div>
  );
}

interface EndpointProps {
  webhook: Webhook;
  pending: boolean;
  onEnabled: (enabled: boolean) => void;
  onRotate: () => void;
}

/** What the webhook sends and where, the switch that applies at once, and its secret's tail. */
export function EndpointSection({ webhook, pending, onEnabled, onRotate }: EndpointProps) {
  return (
    <SettingsSection title="Endpoint" layout="rows">
      <SettingsRow
        title="Send deliveries"
        description={
          webhook.status === 'failing'
            ? 'Off since the receiver kept failing. Turning it on clears the failures.'
            : webhook.enabled
              ? 'Each chosen event is sent as it happens.'
              : 'Paused: events are not sent, and nothing is queued for later.'
        }
        control={
          <Switch
            aria-label="Send deliveries"
            checked={webhook.enabled}
            disabled={pending}
            onCheckedChange={onEnabled}
          />
        }
      />
      <SettingsValues>
        <SettingsValue label="URL" mono>
          {webhook.url}
        </SettingsValue>
        <SettingsValue label="Events">{webhook.events.map(eventLabel).join(', ')}</SettingsValue>
        <SettingsValue label="Format">{formatLabel(webhook.format)}</SettingsValue>
        <SettingsValue
          label="Signing secret"
          hint="Only its last four characters are kept on screen."
        >
          <span className="flex items-center gap-2">
            <span>
              Ends in <span className="font-mono text-12">{webhook.secretHint}</span>
            </span>
            <Button size="xs" icon={<Icon name="refresh" />} onClick={onRotate}>
              Rotate secret…
            </Button>
          </span>
        </SettingsValue>
      </SettingsValues>
    </SettingsSection>
  );
}

interface TestResultProps {
  delivery: WebhookDelivery | null;
  onDismiss: () => void;
}

/** What the last test send got back: the state, the answer, how long it took. */
export function TestResult({ delivery, onDismiss }: TestResultProps) {
  if (!delivery) return null;
  const look = deliveryLook(delivery);
  const duration = durationLabel(delivery.durationMs);
  return (
    <SettingsSection
      title="Test send"
      layout="block"
      actions={
        <IconButton icon="close" size="sm" label="Dismiss the test result" onClick={onDismiss} />
      }
    >
      <div role="status" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-13 tabular-nums">
          <StatePill tone={look.tone}>{look.label}</StatePill>
          <span className="text-tx-2">
            {delivery.responseStatus === null ? 'No answer' : `Answered ${delivery.responseStatus}`}
          </span>
          {duration ? <span className="text-tx-3">{duration}</span> : null}
        </div>
        {delivery.error ? <p className="m-0 text-13 text-red-tx">{delivery.error}</p> : null}
        {delivery.responseExcerpt ? (
          <pre className="m-0 max-h-32 overflow-auto rounded-control bg-sunken px-3 py-2 font-mono text-12 leading-body text-tx-2">
            {delivery.responseExcerpt}
          </pre>
        ) : null}
      </div>
    </SettingsSection>
  );
}

/** The receiver's half: the headers and how to check the signature. */
export function VerifySection() {
  return (
    <SettingsSection title="Verify deliveries" layout="block">
      <VerifyHint />
    </SettingsSection>
  );
}
