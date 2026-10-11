import { WEBHOOK_AUTO_DISABLE_AFTER, WEBHOOK_MAX_ATTEMPTS } from '@bemmoly/shared/webhooks';
import type { Logger } from 'pino';
import type { SqlClient } from '../../clients/postgres.ts';
import type { WebhookClient } from '../../clients/webhook-http.ts';
import type { AuditRecorder } from '../../contracts/audit.ts';
import type { Authorize } from '../../contracts/authz.ts';
import type { EventBus } from '../../contracts/event-bus.ts';
import type { JobQueue } from '../../contracts/jobs.ts';
import type { SecretBox } from '../settings/index.ts';

/** One delivery attempt; retries are queued by the handler itself, with its own backoff. */
export const WEBHOOK_DELIVER_JOB = 'webhook.deliver';

/** Webhooks send workspace data to an address an admin chose: a workspace settings change. */
export const WEBHOOK_CAPABILITY = 'workspace.settings.manage';

export const WORKSPACE = { kind: 'workspace' } as const;

/** The whole call: connect, send, and read the start of the answer. */
export const WEBHOOK_TIMEOUT_MS = 10_000;

const RETRY_BASE_SECONDS = 30;

/**
 * Seconds before the next try after `attempts` failed ones: 30 s, 2 min, 8 min, 32 min and
 * about two hours, so five retries span roughly two and a half hours.
 */
export function backoffSeconds(attempts: number): number {
  return RETRY_BASE_SECONDS * 4 ** Math.max(0, attempts - 1);
}

export interface WebhookDeps {
  sql: SqlClient;
  authorize: Authorize;
  audit: AuditRecorder;
  jobs: JobQueue;
  events: EventBus;
  secrets: SecretBox;
  client: WebhookClient;
  /** BEMMOLY_PUBLIC_URL: links in payloads are absolute. */
  publicUrl: string;
  /** BEMMOLY_ALLOW_PRIVATE_URLS: a target on the private network may be saved. */
  allowPrivateUrls: boolean;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  now?: () => Date;
  /** Tries per event delivery; tests lower it. */
  maxAttempts?: number;
  /** Failed deliveries in a row before the webhook turns itself off. */
  autoDisableAfter?: number;
  /** Delay before a retry; tests make it zero so the queue runs it at once. */
  backoff?: (attempts: number) => number;
}

export const settingsOf = (deps: WebhookDeps) => ({
  now: () => deps.now?.() ?? new Date(),
  maxAttempts: deps.maxAttempts ?? WEBHOOK_MAX_ATTEMPTS,
  autoDisableAfter: deps.autoDisableAfter ?? WEBHOOK_AUTO_DISABLE_AFTER,
  backoff: deps.backoff ?? backoffSeconds,
});
