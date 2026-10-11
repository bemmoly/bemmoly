import { WEBHOOK_HEADERS, WEBHOOK_PAYLOAD_VERSION } from '@bemmoly/shared';
import { RedirectRefusedError } from '../../clients/guarded-fetch.ts';
import { HostLookupError, PrivateAddressError } from '../../clients/network.ts';
import { WebhookTimeoutError } from '../../clients/webhook-http.ts';
import { settingsOf, WEBHOOK_DELIVER_JOB, type WebhookDeps } from './context.ts';
import { PING_EVENT, renderBody } from './envelope.ts';
import { disableFailingWebhook } from './failures.ts';
import type { DeliveryRow, WebhookRow } from './repository.ts';
import { SECRET_CONTEXT, signWebhook } from './signing.ts';

const EXCERPT_CHARS = 500;
const DONE = new Set(['succeeded', 'failed']);

type Joined = DeliveryRow & Pick<WebhookRow, 'url' | 'format' | 'secret_sealed' | 'enabled'>;

/** In words an admin can act on; the class names stay in the log. */
function describe(error: unknown): string {
  if (error instanceof PrivateAddressError) return error.message;
  if (error instanceof RedirectRefusedError)
    return 'The receiver answered with a redirect, which is never followed';
  if (error instanceof WebhookTimeoutError || error instanceof HostLookupError)
    return error.message;
  const cause = (error as { cause?: { code?: unknown } }).cause?.code;
  return `Could not reach the receiver${typeof cause === 'string' ? ` (${cause})` : ''}`;
}

/** Event deliveries count toward turning a webhook off; test sends and redeliveries do not. */
const automatic = (row: DeliveryRow) => row.event !== PING_EVENT && row.redelivery_of === null;

/**
 * One attempt at one delivery: render, sign with the current secret, post, and record the
 * answer. A failure queues the next attempt after the backoff, until the attempts run out;
 * the last failure of an event delivery counts toward turning the webhook off.
 */
export function createDeliverer(deps: WebhookDeps) {
  const { sql } = deps;
  const settings = settingsOf(deps);

  async function send(row: Joined, attempt: number) {
    const body = renderBody(row.format, row.envelope);
    const now = settings.now();
    const secret = deps.secrets.open(row.secret_sealed, SECRET_CONTEXT);
    const headers = {
      'user-agent': `Bemmoly-Webhooks/${WEBHOOK_PAYLOAD_VERSION}`,
      [WEBHOOK_HEADERS.signature]: signWebhook(secret, Math.floor(now.getTime() / 1000), body),
      [WEBHOOK_HEADERS.event]: row.event,
      [WEBHOOK_HEADERS.delivery]: row.id,
      [WEBHOOK_HEADERS.version]: WEBHOOK_PAYLOAD_VERSION,
      'bemmoly-attempt': String(attempt),
    };
    const started = performance.now();
    try {
      const answer = await deps.client.post({ url: row.url, body, headers });
      const ok = answer.status >= 200 && answer.status < 300;
      return {
        ok,
        status: answer.status,
        excerpt: answer.excerpt.slice(0, EXCERPT_CHARS),
        error: ok ? null : `The receiver answered ${answer.status}`,
        durationMs: Math.round(performance.now() - started),
      };
    } catch (error) {
      deps.logger.warn({ err: error, deliveryId: row.id }, 'webhook delivery failed');
      return {
        ok: false,
        status: null,
        excerpt: null,
        error: describe(error),
        durationMs: Math.round(performance.now() - started),
      };
    }
  }

  async function attempt(deliveryId: string): Promise<void> {
    const [row] = await sql<Joined[]>`
      select d.*, w.url, w.format, w.secret_sealed, w.enabled
      from webhook_deliveries d join webhooks w on w.id = d.webhook_id
      where d.id = ${deliveryId}`;
    if (!row || DONE.has(row.status)) return;
    if (!row.enabled && automatic(row)) {
      await sql`
        update webhook_deliveries set status = 'failed', next_attempt_at = null,
          error = 'The webhook is turned off', updated_at = now()
        where id = ${row.id}`;
      return;
    }
    const tries = row.attempt + 1;
    const result = await send(row, tries);
    const now = settings.now();
    const last = result.ok || tries >= row.max_attempts;
    const nextAt = last ? null : new Date(now.getTime() + settings.backoff(tries) * 1000);
    const status = result.ok ? 'succeeded' : last ? 'failed' : 'retrying';
    await sql`
      update webhook_deliveries set status = ${status}, attempt = ${tries},
        response_status = ${result.status}, response_excerpt = ${result.excerpt},
        error = ${result.error}, duration_ms = ${result.durationMs},
        next_attempt_at = ${nextAt?.toISOString() ?? null},
        delivered_at = ${result.ok ? now.toISOString() : null},
        updated_at = now()
      where id = ${row.id}`;
    if (nextAt) {
      await deps.jobs.enqueue(
        WEBHOOK_DELIVER_JOB,
        { deliveryId: row.id },
        { key: `${row.id}:${tries + 1}`, startAfter: nextAt },
      );
    }
    if (!automatic(row)) return;
    if (result.ok) {
      await sql`
        update webhooks set consecutive_failures = 0, last_delivery_at = ${now.toISOString()}
        where id = ${row.webhook_id}`;
    } else if (last) {
      const [counted] = await sql<{ consecutive_failures: number; enabled: boolean }[]>`
        update webhooks set consecutive_failures = consecutive_failures + 1,
          last_delivery_at = ${now.toISOString()}
        where id = ${row.webhook_id}
        returning consecutive_failures, enabled`;
      if (counted?.enabled && counted.consecutive_failures >= settings.autoDisableAfter) {
        await disableFailingWebhook(deps, row.webhook_id, counted.consecutive_failures);
      }
    }
  }

  return { attempt };
}

export type Deliverer = ReturnType<typeof createDeliverer>;
