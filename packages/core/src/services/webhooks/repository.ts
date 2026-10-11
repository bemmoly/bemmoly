import {
  NotFoundError,
  type Webhook,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookEnvelope,
  type WebhookFormat,
} from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  events: string[];
  format: WebhookFormat;
  secret_sealed: string;
  secret_hint: string;
  enabled: boolean;
  disabled_reason: string | null;
  consecutive_failures: number;
  last_delivery_at: Date | string | null;
  created_by: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface DeliveryRow {
  id: string;
  webhook_id: string;
  event: string;
  event_id: string;
  envelope: WebhookEnvelope;
  status: WebhookDeliveryStatus;
  attempt: number;
  max_attempts: number;
  response_status: number | null;
  response_excerpt: string | null;
  error: string | null;
  duration_ms: number | null;
  next_attempt_at: Date | string | null;
  redelivery_of: string | null;
  delivered_at: Date | string | null;
  created_at: Date | string;
}

const iso = (value: Date | string | null): string | null =>
  value ? new Date(value).toISOString() : null;

/** The client's view: the sealed secret never leaves the server, only its last characters. */
export function toWebhook(row: WebhookRow): Webhook {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    events: row.events as Webhook['events'],
    format: row.format,
    enabled: row.enabled,
    status: row.enabled ? 'active' : row.disabled_reason ? 'failing' : 'paused',
    disabledReason: row.disabled_reason,
    consecutiveFailures: row.consecutive_failures,
    secretHint: row.secret_hint,
    lastDeliveryAt: iso(row.last_delivery_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

export function toDelivery(row: DeliveryRow): WebhookDelivery {
  return {
    id: row.id,
    webhookId: row.webhook_id,
    event: row.event,
    eventId: row.event_id,
    status: row.status,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    responseStatus: row.response_status,
    responseExcerpt: row.response_excerpt,
    error: row.error,
    durationMs: row.duration_ms,
    nextAttemptAt: iso(row.next_attempt_at),
    redeliveryOf: row.redelivery_of,
    createdAt: iso(row.created_at)!,
    deliveredAt: iso(row.delivered_at),
  };
}

export async function webhookById(sql: SqlExecutor, id: string): Promise<WebhookRow> {
  const [row] = await sql<WebhookRow[]>`select * from webhooks where id = ${id}`;
  if (!row) throw new NotFoundError('The webhook was not found');
  return row;
}

export async function deliveryById(
  sql: SqlExecutor,
  webhookId: string,
  id: string,
): Promise<DeliveryRow> {
  const [row] = await sql<DeliveryRow[]>`
    select * from webhook_deliveries where id = ${id} and webhook_id = ${webhookId}`;
  if (!row) throw new NotFoundError('The delivery was not found');
  return row;
}

export interface NewDelivery {
  webhookId: string;
  event: string;
  eventId: string;
  envelope: WebhookEnvelope;
  maxAttempts: number;
  redeliveryOf?: string;
}

export async function insertDelivery(sql: SqlExecutor, input: NewDelivery): Promise<DeliveryRow> {
  const [row] = await sql<DeliveryRow[]>`
    insert into webhook_deliveries (webhook_id, event, event_id, envelope, max_attempts,
      redelivery_of)
    values (${input.webhookId}, ${input.event}, ${input.eventId},
      ${JSON.stringify(input.envelope)}::jsonb, ${input.maxAttempts},
      ${input.redeliveryOf ?? null})
    returning *`;
  if (!row) throw new NotFoundError('The delivery was not stored');
  return row;
}

/** Newest first, keyset on the UUIDv7 id. */
export async function listDeliveries(
  sql: SqlExecutor,
  webhookId: string,
  query: { cursor?: string | undefined; limit: number; status?: WebhookDeliveryStatus | undefined },
): Promise<{ items: WebhookDelivery[]; nextCursor: string | null }> {
  const rows = await sql<DeliveryRow[]>`
    select * from webhook_deliveries
    where webhook_id = ${webhookId}
      ${query.status ? sql`and status = ${query.status}` : sql``}
      ${query.cursor ? sql`and id < ${query.cursor}` : sql``}
    order by id desc
    limit ${query.limit + 1}`;
  const page = rows.slice(0, query.limit);
  return {
    items: page.map(toDelivery),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
  };
}

const RETENTION_DAYS = 30;

/** Housekeeping: the delivery log keeps a month. */
export async function deleteOldWebhookDeliveries(sql: SqlExecutor, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const rows = await sql`
    delete from webhook_deliveries
    where created_at < ${cutoff.toISOString()} and status in ('succeeded', 'failed')
    returning id`;
  return rows.length;
}
