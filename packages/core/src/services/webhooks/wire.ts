import type { Logger } from 'pino';
import { z } from 'zod';
import type { SqlClient } from '../../clients/postgres.ts';
import { createWebhookClient, type WebhookClient } from '../../clients/webhook-http.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus, Unsubscribe } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import { createAuditRecorder } from '../audit/index.ts';
import type { SecretBox } from '../settings/index.ts';
import { createWebhookAdmin, type WebhookAdmin } from './admin.ts';
import { WEBHOOK_DELIVER_JOB, WEBHOOK_TIMEOUT_MS, type WebhookDeps } from './context.ts';
import { createDeliverer } from './delivery.ts';
import { subscribeWebhookEvents } from './subscriptions.ts';

export interface WebhooksWiring {
  sql: SqlClient;
  jobs: JobQueue;
  events: EventBus;
  authorize: Authorize;
  secrets: SecretBox;
  publicUrl: string;
  /** BEMMOLY_ALLOW_PRIVATE_URLS: targets on loopback and private networks are allowed. */
  allowPrivateUrls: boolean;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  /** Tests pass a client with a short timeout, or shorter retries and thresholds below. */
  client?: WebhookClient;
  tuning?: Pick<WebhookDeps, 'maxAttempts' | 'autoDisableAfter' | 'backoff' | 'now'>;
}

export interface Webhooks {
  service: WebhookAdmin;
  /** Runs one delivery attempt now, as the queue would; for tests. */
  attempt(deliveryId: string): Promise<void>;
  stop: Unsubscribe;
}

const payloadSchema = z.object({ deliveryId: z.uuid() });

/**
 * Settings › Webhooks' service, the `webhook.deliver` job (retries are its own, so the queue
 * never retries it) and the subscriptions that turn domain events into deliveries.
 */
export function wireWebhooks(wiring: WebhooksWiring): Webhooks {
  const deps: WebhookDeps = {
    sql: wiring.sql,
    authorize: wiring.authorize,
    audit: createAuditRecorder(wiring.sql),
    jobs: wiring.jobs,
    events: wiring.events,
    secrets: wiring.secrets,
    client:
      wiring.client ??
      createWebhookClient({
        policy: wiring.allowPrivateUrls ? 'any' : 'public',
        timeoutMs: WEBHOOK_TIMEOUT_MS,
      }),
    publicUrl: wiring.publicUrl,
    allowPrivateUrls: wiring.allowPrivateUrls,
    logger: wiring.logger,
    ...wiring.tuning,
  };
  const deliverer = createDeliverer(deps);
  // Each attempt is one delivery row and one POST: safe side by side (the failure count and
  // auto-disable are single conditional updates), and one slow receiver must not hold up the
  // others for its whole timeout. Retries are the handler's own backoff, never the queue's.
  wiring.jobs.register(
    WEBHOOK_DELIVER_JOB,
    async (payload) => deliverer.attempt(payloadSchema.parse(payload).deliveryId),
    { retryLimit: 0, concurrency: 4, expireInSeconds: 120 },
  );
  return {
    service: createWebhookAdmin(deps, deliverer),
    attempt: (id) => deliverer.attempt(id),
    stop: subscribeWebhookEvents(wiring.events, deps),
  };
}
