import { randomUUID } from 'node:crypto';
import {
  AUTOMATION_WEBHOOK_EVENT,
  WEBHOOK_EVENT_KINDS,
  WEBHOOK_REQUESTED_EVENT,
  webhookRequestedPayloadSchema,
} from '@bemmoly/shared';
import type { DomainEvent, EventBus, Unsubscribe } from '../../contracts/event-bus.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { settingsOf, WEBHOOK_DELIVER_JOB, type WebhookDeps } from './context.ts';
import { envelopeFor } from './envelope.ts';
import { insertDelivery } from './repository.ts';

/**
 * One delivery row and one job per webhook, inside the publisher's transaction when it has
 * one, so a rolled back change is never announced and a committed one always is.
 */
async function queue(
  deps: WebhookDeps,
  executor: SqlExecutor,
  webhookIds: readonly string[],
  event: Pick<DomainEvent, 'kind' | 'occurredAt' | 'actor' | 'entity' | 'payload'>,
): Promise<void> {
  if (webhookIds.length === 0) return;
  const eventId = randomUUID();
  const envelope = envelopeFor(event, eventId, deps.publicUrl);
  const { maxAttempts } = settingsOf(deps);
  for (const webhookId of webhookIds) {
    const row = await insertDelivery(executor, {
      webhookId,
      event: event.kind,
      eventId,
      envelope,
      maxAttempts,
    });
    await deps.jobs.enqueue(
      WEBHOOK_DELIVER_JOB,
      { deliveryId: row.id },
      { key: `${row.id}:1`, ...(executor === deps.sql ? {} : { transaction: executor }) },
    );
  }
}

async function onDomainEvent(deps: WebhookDeps, event: DomainEvent): Promise<void> {
  const executor = event.transaction ?? deps.sql;
  const rows = await executor<{ id: string }[]>`
    select id from webhooks where enabled and ${event.kind} = any(events) order by id`;
  await queue(
    deps,
    executor,
    rows.map((row) => row.id),
    event,
  );
}

/** An automation rule's "send webhook": one delivery to that webhook, if it is on. */
async function onRequested(deps: WebhookDeps, event: DomainEvent): Promise<void> {
  const parsed = webhookRequestedPayloadSchema.safeParse(event.payload);
  if (!parsed.success) {
    deps.logger.warn({ payload: event.payload }, 'ignored a malformed webhook request');
    return;
  }
  const executor = event.transaction ?? deps.sql;
  const { webhookId, summary, url, data } = parsed.data;
  const rows = await executor<{ id: string }[]>`
    select id from webhooks where id = ${webhookId} and enabled`;
  if (rows.length === 0) {
    deps.logger.info({ webhookId }, 'skipped a webhook request: the webhook is off or gone');
    return;
  }
  await queue(deps, executor, [webhookId], {
    kind: AUTOMATION_WEBHOOK_EVENT,
    occurredAt: event.occurredAt,
    ...(event.actor ? { actor: event.actor } : {}),
    ...(event.entity ? { entity: event.entity } : {}),
    payload: { ...data, summary, ...(url ? { url } : {}) },
  });
}

/** Every event kind a webhook can listen to, plus the automation request. */
export function subscribeWebhookEvents(bus: EventBus, deps: WebhookDeps): Unsubscribe {
  const subscriptions = [
    ...WEBHOOK_EVENT_KINDS.map((kind) =>
      bus.subscribe(kind, (event) => onDomainEvent(deps, event)),
    ),
    bus.subscribe(WEBHOOK_REQUESTED_EVENT, (event) => onRequested(deps, event)),
  ];
  return () => {
    for (const unsubscribe of subscriptions) unsubscribe();
  };
}
