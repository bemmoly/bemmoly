import { isApiError } from '@bemmoly/api-client';
import { useHeaderTrail } from '@bemmoly/core-web';
import {
  Button,
  ConfirmChange,
  EmptyState,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
} from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { FormError } from '../../../components/form.tsx';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { SettingsSkeleton } from '../../../components/settings/settings-states.tsx';
import { useSearchParam } from '../../../hooks/use-search-param.ts';
import { useWebhookDeliveries } from '../../../hooks/use-webhook-deliveries.ts';
import { useWebhook } from '../../../hooks/use-webhooks.ts';
import { DeliveriesSection } from './webhook-deliveries.tsx';
import { EndpointSection, FailingBanner, TestResult, VerifySection } from './webhook-endpoint.tsx';
import { WebhookFormModal } from './webhook-form-modal.tsx';
import { SecretModal } from './webhook-secret.tsx';
import { WebhooksFailure } from './webhooks-states.tsx';

type Asking = 'rotate' | 'delete' | null;

/** Settings › Webhooks › one webhook: its health, its endpoint, a test send and the delivery log. */
export function WebhookPage() {
  const { webhookId = '' } = useParams({ strict: false }) as { webhookId?: string };
  const hook = useWebhook(webhookId);
  const log = useWebhookDeliveries(webhookId);
  const navigate = useNavigate();
  const [editing, setEditing] = useSearchParam('edit');
  const [asking, setAsking] = useState<Asking>(null);
  const { webhook } = hook;
  useHeaderTrail(
    webhook
      ? [
          { label: 'Webhooks', path: '/settings/webhooks' },
          { label: webhook.name, path: `/settings/webhooks/${webhookId}` },
        ]
      : null,
  );
  const back = () => void navigate({ to: '/settings/webhooks' });

  if (isApiError(hook.query.error) && hook.query.error.status === 404) {
    return (
      <EmptyState
        icon={<Icon name="globe" />}
        title="This webhook was deleted"
        description="It no longer sends anything. Its delivery log went with it."
        action={<Button onClick={back}>All webhooks</Button>}
      />
    );
  }
  const actions = webhook ? (
    <>
      <Button
        icon={<Icon name="zap" />}
        loading={hook.ping.isPending}
        onClick={() => hook.ping.mutate()}
      >
        Send test
      </Button>
      <Button icon={<Icon name="edit" />} onClick={() => setEditing('1')}>
        Edit…
      </Button>
      <Menu
        align="end"
        trigger={(props) => <IconButton {...props} icon="more" label="More webhook actions" />}
      >
        <MenuItem icon={<Icon name="refresh" />} onSelect={() => setAsking('rotate')}>
          Rotate secret…
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Icon name="trash" />} tone="danger" onSelect={() => setAsking('delete')}>
          Delete webhook…
        </MenuItem>
      </Menu>
    </>
  ) : null;
  return (
    <SettingsPage
      title={webhook?.name ?? 'Webhook'}
      description={webhook ? <span className="font-mono text-12">{webhook.url}</span> : undefined}
      loading={hook.query.isPending}
      skeleton={<SettingsSkeleton sections={3} rows={3} />}
      actions={actions}
    >
      {hook.query.error || !webhook ? (
        <WebhooksFailure error={hook.query.error} />
      ) : (
        <>
          <FailingBanner
            webhook={webhook}
            busy={hook.setEnabled.isPending}
            onEnable={() => hook.setEnabled.mutate(true)}
          />
          <TestResult delivery={hook.test} onDismiss={hook.clearTest} />
          <EndpointSection
            webhook={webhook}
            pending={hook.setEnabled.isPending}
            onEnabled={(on) => hook.setEnabled.mutate(on)}
            onRotate={() => setAsking('rotate')}
          />
          <DeliveriesSection
            log={log}
            testing={hook.ping.isPending}
            onTest={() => hook.ping.mutate()}
          />
          <VerifySection />
          {editing ? (
            <WebhookFormModal editing={webhook} onClose={() => setEditing(null, true)} />
          ) : null}
          <ConfirmChange
            open={asking === 'rotate'}
            title="Rotate the signing secret?"
            consequences={[
              'The old secret stops working at once; deliveries signed with the new one fail until the receiver has it.',
              'The new secret is shown once.',
            ]}
            confirmLabel="Rotate secret"
            busy={hook.rotate.isPending}
            error={hook.rotate.error ? <FormError error={hook.rotate.error} /> : null}
            onConfirm={() => hook.rotate.mutate(undefined, { onSuccess: () => setAsking(null) })}
            onCancel={() => setAsking(null)}
          />
          <ConfirmChange
            open={asking === 'delete'}
            title={`Delete ${webhook.name}?`}
            consequences={[
              'Nothing more is sent to this URL, and its delivery log is deleted.',
              'Rules that send to it stop sending. This cannot be undone.',
            ]}
            confirmLabel="Delete webhook"
            busy={hook.remove.isPending}
            error={hook.remove.error ? <FormError error={hook.remove.error} /> : null}
            onConfirm={() => hook.remove.mutate(undefined, { onSuccess: back })}
            onCancel={() => setAsking(null)}
          />
          <SecretModal
            title="Copy the new signing secret"
            secret={hook.secret?.secret ?? null}
            onDone={hook.clearSecret}
          />
        </>
      )}
    </SettingsPage>
  );
}
