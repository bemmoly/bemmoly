import {
  WEBHOOK_MAX_ATTEMPTS,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
} from '@bemmoly/shared/webhooks';
import { ago, ahead, uid } from './time.ts';

/*
 * Settings › Webhooks as the demo shows it: a chat channel that is healthy, a
 * service that is paused, and one that turned itself off after its receiver
 * kept failing. Secrets are plain words so a scanner never mistakes them.
 */

export const WEBHOOK_IDS = {
  chat: uid(0xa00),
  releases: uid(0xa01),
  billing: uid(0xa02),
} as const;

export interface StoredWebhook extends Webhook {
  secret: string;
}

/** A secret shaped like the server's: a prefix, then characters a scanner reads as words. */
export const mockSecret = (word: string) => `whsec_mock_signing_secret_${word}`;

export function seedWebhooks(): StoredWebhook[] {
  const base = { consecutiveFailures: 0, disabledReason: null, updatedAt: ago(60 * 24) };
  const rows: Omit<StoredWebhook, 'secretHint'>[] = [
    {
      ...base,
      id: WEBHOOK_IDS.chat,
      name: 'Platform channel',
      url: 'https://chat.acmelabs.dev/hooks/platform-team',
      events: ['issue.created', 'issue.transitioned', 'sprint.completed'],
      format: 'chat_blocks',
      enabled: true,
      status: 'active',
      secret: mockSecret('platform'),
      lastDeliveryAt: ago(12),
      createdAt: ago(60 * 24 * 30),
    },
    {
      ...base,
      id: WEBHOOK_IDS.releases,
      name: 'Release notes service',
      url: 'https://releases.acmelabs.dev/bemmoly/events',
      events: ['sprint.completed', 'page.published'],
      format: 'json',
      enabled: false,
      status: 'paused',
      secret: mockSecret('releases'),
      lastDeliveryAt: ago(60 * 24 * 6),
      createdAt: ago(60 * 24 * 60),
    },
    {
      ...base,
      id: WEBHOOK_IDS.billing,
      name: 'Billing sync',
      url: 'https://billing.acmelabs.dev/hooks/issues',
      events: ['issue.updated', 'issue.transitioned'],
      format: 'json',
      enabled: false,
      status: 'failing',
      disabledReason: 'The receiver answered 503 Service Unavailable to 5 deliveries in a row.',
      consecutiveFailures: 5,
      secret: mockSecret('billing'),
      lastDeliveryAt: ago(95),
      createdAt: ago(60 * 24 * 20),
    },
  ];
  return rows.map((row) => ({ ...row, secretHint: row.secret.slice(-4) }));
}

interface DeliverySeed {
  minutes: number;
  event: string;
  status: WebhookDeliveryStatus;
  attempt: number;
  code: number | null;
  ms: number | null;
  error?: string;
  excerpt?: string;
}

function delivery(webhookId: string, n: number, seed: DeliverySeed): WebhookDelivery {
  const done = seed.status === 'succeeded' || seed.status === 'failed';
  return {
    id: uid(0xb00 + n),
    webhookId,
    event: seed.event,
    eventId: uid(0xc00 + n),
    status: seed.status,
    attempt: seed.attempt,
    maxAttempts: WEBHOOK_MAX_ATTEMPTS,
    responseStatus: seed.code,
    responseExcerpt: seed.excerpt ?? (seed.code === 200 ? 'ok' : null),
    error: seed.error ?? null,
    durationMs: seed.ms,
    nextAttemptAt: seed.status === 'retrying' ? ahead(4) : null,
    redeliveryOf: null,
    createdAt: ago(seed.minutes),
    deliveredAt: done ? ago(seed.minutes) : null,
  };
}

const UNAVAILABLE = 'The receiver answered 503 Service Unavailable.';

export function seedDeliveries(): WebhookDelivery[] {
  const chat: DeliverySeed[] = [
    {
      minutes: 12,
      event: 'issue.transitioned',
      status: 'succeeded',
      attempt: 1,
      code: 200,
      ms: 182,
    },
    { minutes: 41, event: 'issue.created', status: 'retrying', attempt: 2, code: 429, ms: 96 },
    { minutes: 75, event: 'issue.created', status: 'succeeded', attempt: 1, code: 200, ms: 164 },
    {
      minutes: 190,
      event: 'sprint.completed',
      status: 'succeeded',
      attempt: 1,
      code: 200,
      ms: 240,
    },
    {
      minutes: 60 * 26,
      event: 'issue.transitioned',
      status: 'failed',
      attempt: WEBHOOK_MAX_ATTEMPTS,
      code: null,
      ms: 10_000,
      error: 'The receiver did not answer within 10 seconds.',
    },
  ];
  const billing: DeliverySeed[] = Array.from({ length: 5 }, (_, index) => ({
    minutes: 95 + index * 40,
    event: index % 2 ? 'issue.updated' : 'issue.transitioned',
    status: 'failed' as const,
    attempt: WEBHOOK_MAX_ATTEMPTS,
    code: 503,
    ms: 1_200 + index * 35,
    error: UNAVAILABLE,
    excerpt:
      '<html><body><h1>503 Service Unavailable</h1>Upstream is down for maintenance.</body></html>',
  }));
  const releases: DeliverySeed[] = [
    {
      minutes: 60 * 24 * 6,
      event: 'page.published',
      status: 'succeeded',
      attempt: 1,
      code: 204,
      ms: 88,
    },
  ];
  // Enough rows on the chat webhook that its log pages.
  const older: DeliverySeed[] = Array.from({ length: 30 }, (_, index) => ({
    minutes: 60 * 30 + index * 90,
    event: index % 3 ? 'issue.created' : 'issue.transitioned',
    status: 'succeeded' as const,
    attempt: 1,
    code: 200,
    ms: 120 + ((index * 37) % 200),
  }));
  let n = 0;
  const build = (id: string, rows: DeliverySeed[]) => rows.map((row) => delivery(id, n++, row));
  return [
    ...build(WEBHOOK_IDS.chat, [...chat, ...older]),
    ...build(WEBHOOK_IDS.billing, billing),
    ...build(WEBHOOK_IDS.releases, releases),
  ];
}
