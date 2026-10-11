import { Button, EmptyState } from '@bemmoly/ui';
import { Icon } from '@bemmoly/ui/icons';
import { useNavigate } from '@tanstack/react-router';
import { SettingsPage } from '../../../components/settings/settings-page.tsx';
import { useSearchParam } from '../../../hooks/use-search-param.ts';
import { useWebhooks } from '../../../hooks/use-webhooks.ts';
import { WebhookFormModal } from './webhook-form-modal.tsx';
import { WebhooksFailure } from './webhooks-states.tsx';
import { WebhooksSkeleton, WebhooksTable } from './webhooks-table.tsx';

/**
 * Settings › Webhooks: the workspace's outgoing webhooks, each a receiver of chosen events in
 * a chosen shape, signed with its own secret. Rows open the webhook and its delivery log.
 */
export function WebhooksPage() {
  const { query, webhooks } = useWebhooks();
  const navigate = useNavigate();
  const [creating, setCreating] = useSearchParam('create');
  const open = (id: string) =>
    void navigate({ to: '/settings/webhooks/$webhookId', params: { webhookId: id } });
  const create = (
    <Button variant="primary" icon={<Icon name="plus" />} onClick={() => setCreating('webhook')}>
      New webhook
    </Button>
  );
  const failed = query.error;
  return (
    <SettingsPage
      title="Webhooks"
      description="Send issue, sprint and page events to chat tools and your own services. Every delivery is signed, so a receiver can check it came from this workspace."
      loading={query.isPending}
      skeleton={<WebhooksSkeleton />}
      actions={failed ? undefined : create}
    >
      {failed ? (
        <WebhooksFailure error={failed} />
      ) : (
        <WebhooksTable
          webhooks={webhooks}
          onOpen={(webhook) => open(webhook.id)}
          empty={
            <EmptyState
              icon={<Icon name="globe" />}
              title="No webhooks yet"
              description="Send issue and page events to chat tools or your own services."
              action={create}
            />
          }
        />
      )}
      {creating ? (
        <WebhookFormModal
          editing={null}
          onClose={() => setCreating(null, true)}
          onCreated={(id) => open(id)}
        />
      ) : null}
    </SettingsPage>
  );
}
