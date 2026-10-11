import { isApiError } from '@bemmoly/api-client';
import { webhookKeys } from '@bemmoly/api-client/webhooks';
import {
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookWithSecret,
} from '@bemmoly/shared/webhooks';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { PillTone } from '../components/settings/state-pill.tsx';
import { toast } from '../lib/toast.ts';
import { webhooksApi } from '../lib/webhooks-api.ts';

/** The secret is shown once and never cached. */
const withoutSecret = ({ secret: _secret, ...webhook }: WebhookWithSecret): Webhook => webhook;

export const webhookKey = (id: string) => [...webhookKeys.all(), 'one', id] as const;

/** "chat.acmelabs.dev": the receiving host, which tells two webhooks apart at a glance. */
export function urlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const EVENT_LABELS: Record<string, string> = {
  ...Object.fromEntries(WEBHOOK_EVENTS.map((event) => [event.kind, event.label])),
  ping: 'Test send',
  'automation.triggered': 'Automation rule',
};

export const eventLabel = (kind: string) => EVENT_LABELS[kind] ?? kind;

export const formatLabel = (format: Webhook['format']) =>
  WEBHOOK_FORMATS.find((preset) => preset.id === format)?.label ?? format;

export const eventsCount = (count: number) => (count === 1 ? '1 event' : `${count} events`);

export interface StateLook {
  tone: PillTone;
  label: string;
}

const WEBHOOK_LOOK: Record<Webhook['status'], StateLook> = {
  active: { tone: 'ok', label: 'Active' },
  paused: { tone: 'neutral', label: 'Paused' },
  failing: { tone: 'red', label: 'Failing' },
};

export const webhookLook = (webhook: Pick<Webhook, 'status'>) => WEBHOOK_LOOK[webhook.status];

const DELIVERY_LOOK: Record<WebhookDeliveryStatus, StateLook> = {
  succeeded: { tone: 'ok', label: 'Delivered' },
  failed: { tone: 'red', label: 'Failed' },
  retrying: { tone: 'warn', label: 'Retrying' },
  pending: { tone: 'neutral', label: 'Queued' },
};

export const deliveryLook = (delivery: Pick<WebhookDelivery, 'status'>) =>
  DELIVERY_LOOK[delivery.status];

/** "2 of 6": which try this was, of the most it gets. */
export const attemptLabel = (delivery: Pick<WebhookDelivery, 'attempt' | 'maxAttempts'>) =>
  `${Math.max(delivery.attempt, 1)} of ${delivery.maxAttempts}`;

export const durationLabel = (ms: number | null) =>
  ms === null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;

/** The server refused for want of a capability, as opposed to failing. */
export const isForbidden = (error: unknown) => isApiError(error) && error.status === 403;

/** Settings › Webhooks: every webhook of the workspace. */
export function useWebhooks() {
  const query = useQuery({
    queryKey: webhookKeys.list(),
    queryFn: () => webhooksApi.list(),
  });
  return { query, webhooks: query.data?.items ?? [] };
}

/**
 * One webhook and what can be done to it: turn it on or off at once (rolled back if refused),
 * send a test, rotate its secret (shown once), delete it.
 */
export function useWebhook(id: string) {
  const client = useQueryClient();
  const key = webhookKey(id);
  const query = useQuery({
    queryKey: key,
    queryFn: () => webhooksApi.get(id),
    initialData: () =>
      client
        .getQueryData<{ items: Webhook[] }>(webhookKeys.list())
        ?.items.find((webhook) => webhook.id === id),
  });
  const refresh = () => client.invalidateQueries({ queryKey: webhookKeys.all() });
  const [secret, setSecret] = useState<WebhookWithSecret | null>(null);
  const [test, setTest] = useState<WebhookDelivery | null>(null);

  const setEnabled = useMutation({
    mutationFn: (enabled: boolean) => webhooksApi.update(id, { enabled }),
    onMutate: (enabled) => {
      const before = client.getQueryData<Webhook>(key);
      if (before) {
        const status = enabled ? 'active' : before.status === 'failing' ? 'failing' : 'paused';
        client.setQueryData<Webhook>(key, { ...before, enabled, status });
      }
      return { before };
    },
    onError: (error, enabled, context) => {
      if (context?.before) client.setQueryData(key, context.before);
      toast(
        enabled
          ? `Couldn't turn the webhook on. ${error.message}`
          : `Couldn't pause it. ${error.message}`,
        'danger',
      );
    },
    onSuccess: (webhook) => {
      client.setQueryData(key, webhook);
      toast(webhook.enabled ? `${webhook.name} is on` : `${webhook.name} is paused`);
    },
    onSettled: refresh,
  });

  const ping = useMutation({
    mutationFn: () => webhooksApi.deliver(id, { kind: 'ping' }),
    onSuccess: (delivery) => {
      setTest(delivery);
      void client.invalidateQueries({ queryKey: webhookKeys.deliveries(id) });
    },
    onError: (error) => toast(`The test was not sent. ${error.message}`, 'danger'),
  });

  const rotate = useMutation({
    mutationFn: () => webhooksApi.rotateSecret(id),
    onSuccess: (webhook) => {
      setSecret(webhook);
      client.setQueryData(key, withoutSecret(webhook));
    },
  });

  const remove = useMutation({
    mutationFn: () => webhooksApi.remove(id),
    onSuccess: async () => {
      client.removeQueries({ queryKey: key });
      await client.invalidateQueries({ queryKey: webhookKeys.list() });
      toast(`${query.data?.name ?? 'Webhook'} deleted`);
    },
  });

  return {
    query,
    webhook: query.data,
    setEnabled,
    ping,
    test,
    clearTest: () => setTest(null),
    rotate,
    secret,
    clearSecret: () => {
      setSecret(null);
      rotate.reset();
    },
    remove,
  };
}
