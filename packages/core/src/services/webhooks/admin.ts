import { randomUUID } from 'node:crypto';
import {
  createWebhookBodySchema,
  updateWebhookBodySchema,
  ValidationError,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  type CreateWebhookBody,
  type CreateWebhookDeliveryBody,
  type UpdateWebhookBody,
  type Webhook,
  type WebhookCatalog,
  type WebhookDelivery,
  type WebhookDeliveryStatus,
  type WebhookTarget,
  type WebhookWithSecret,
} from '@bemmoly/shared';
import { assertAddressAllowed } from '../../clients/guarded-fetch.ts';
import type { Actor } from '../../contracts/authz.ts';
import {
  settingsOf,
  WEBHOOK_CAPABILITY,
  WEBHOOK_DELIVER_JOB,
  WORKSPACE,
  type WebhookDeps,
} from './context.ts';
import type { Deliverer } from './delivery.ts';
import { pingEnvelope, PING_EVENT } from './envelope.ts';
import {
  deliveryById,
  insertDelivery,
  listDeliveries,
  toDelivery,
  toWebhook,
  webhookById,
  type WebhookRow,
} from './repository.ts';
import { generateWebhookSecret, SECRET_CONTEXT, secretHint } from './signing.ts';

const userIdOf = (actor: Actor) => actor.userId ?? (actor.kind === 'user' ? actor.id : null);

const audited = (webhook: Pick<WebhookRow, 'name' | 'url' | 'events' | 'format' | 'enabled'>) => ({
  name: webhook.name,
  url: webhook.url,
  events: webhook.events,
  format: webhook.format,
  enabled: webhook.enabled,
});

/**
 * Settings › Webhooks. Every call is an admin's (workspace.settings.manage) and audited; the
 * target address is checked against private networks when it is saved and again on every
 * delivery. The secret goes in sealed and comes back out only in the answer that made it.
 */
export function createWebhookAdmin(deps: WebhookDeps, deliverer: Deliverer) {
  const { sql } = deps;
  const settings = settingsOf(deps);
  const admin = (actor: Actor) => deps.authorize(actor, WEBHOOK_CAPABILITY, WORKSPACE);

  async function checkTarget(url: string): Promise<void> {
    if (deps.allowPrivateUrls) return;
    try {
      await assertAddressAllowed(url, 'public');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The address is not reachable';
      throw new ValidationError(message, { details: { issues: [{ path: 'url', message }] } });
    }
  }

  async function record(
    actor: Actor,
    action: string,
    id: string,
    before?: unknown,
    after?: unknown,
  ) {
    await deps.audit.record({
      actor,
      action,
      target: { kind: 'webhook', id },
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
    });
  }

  return {
    async catalog(actor: Actor): Promise<WebhookCatalog> {
      await admin(actor);
      return {
        events: WEBHOOK_EVENTS.map((event) => ({ ...event })),
        formats: WEBHOOK_FORMATS.map((format) => ({ ...format })),
      };
    },

    /** Names for a rule builder's picker: no address, no secret, readable by any person. */
    async targets(actor: Actor): Promise<WebhookTarget[]> {
      if (!userIdOf(actor)) await admin(actor);
      return sql<WebhookTarget[]>`select id, name, enabled from webhooks order by name, id`;
    },

    async list(actor: Actor): Promise<Webhook[]> {
      await admin(actor);
      const rows = await sql<WebhookRow[]>`select * from webhooks order by created_at, id`;
      return rows.map(toWebhook);
    },

    async get(actor: Actor, id: string): Promise<Webhook> {
      await admin(actor);
      return toWebhook(await webhookById(sql, id));
    },

    async create(actor: Actor, input: CreateWebhookBody): Promise<WebhookWithSecret> {
      await admin(actor);
      const body = createWebhookBodySchema.parse(input);
      await checkTarget(body.url);
      const secret = generateWebhookSecret();
      const [row] = await sql<WebhookRow[]>`
        insert into webhooks (name, url, events, format, secret_sealed, secret_hint, enabled,
          created_by)
        values (${body.name}, ${body.url}, ${body.events}, ${body.format},
          ${deps.secrets.seal(secret, SECRET_CONTEXT)}, ${secretHint(secret)}, ${body.enabled},
          ${userIdOf(actor)})
        returning *`;
      await record(actor, 'webhook.created', row!.id, undefined, audited(row!));
      return { ...toWebhook(row!), secret };
    },

    async update(actor: Actor, id: string, input: UpdateWebhookBody): Promise<Webhook> {
      await admin(actor);
      const body = updateWebhookBodySchema.parse(input);
      const before = await webhookById(sql, id);
      if (body.url !== undefined && body.url !== before.url) await checkTarget(body.url);
      const next = { ...before, ...body };
      // Turning it on starts the failure count again; turning it off by hand is a pause.
      const reset = body.enabled !== undefined && body.enabled !== before.enabled;
      const [row] = await sql<WebhookRow[]>`
        update webhooks set name = ${next.name}, url = ${next.url}, events = ${next.events},
          format = ${next.format}, enabled = ${next.enabled},
          disabled_reason = ${reset ? null : before.disabled_reason},
          consecutive_failures = ${reset ? 0 : before.consecutive_failures},
          updated_at = now()
        where id = ${id}
        returning *`;
      await record(actor, 'webhook.updated', id, audited(before), audited(row!));
      return toWebhook(row!);
    },

    async remove(actor: Actor, id: string): Promise<void> {
      await admin(actor);
      const before = await webhookById(sql, id);
      await sql`delete from webhooks where id = ${id}`;
      await record(actor, 'webhook.deleted', id, audited(before));
    },

    /** The old secret stops working at once: deliveries sign when they are sent. */
    async rotateSecret(actor: Actor, id: string): Promise<WebhookWithSecret> {
      await admin(actor);
      await webhookById(sql, id);
      const secret = generateWebhookSecret();
      const [row] = await sql<WebhookRow[]>`
        update webhooks set secret_sealed = ${deps.secrets.seal(secret, SECRET_CONTEXT)},
          secret_hint = ${secretHint(secret)}, updated_at = now()
        where id = ${id}
        returning *`;
      await record(actor, 'webhook.secret_rotated', id, undefined, {
        secretHint: secretHint(secret),
      });
      return { ...toWebhook(row!), secret };
    },

    async deliveries(
      actor: Actor,
      id: string,
      query: {
        cursor?: string | undefined;
        limit: number;
        status?: WebhookDeliveryStatus | undefined;
      },
    ) {
      await admin(actor);
      await webhookById(sql, id);
      return listDeliveries(sql, id, query);
    },

    /**
     * A test send runs its one attempt now and answers with the outcome; a redelivery copies
     * an earlier delivery (same event id, same envelope) and queues it with full retries.
     */
    async deliver(
      actor: Actor,
      id: string,
      body: CreateWebhookDeliveryBody,
    ): Promise<WebhookDelivery> {
      await admin(actor);
      await webhookById(sql, id);
      if (body.kind === 'ping') {
        const eventId = randomUUID();
        const row = await insertDelivery(sql, {
          webhookId: id,
          event: PING_EVENT,
          eventId,
          envelope: pingEnvelope(eventId, deps.publicUrl, settings.now()),
          maxAttempts: 1,
        });
        await deliverer.attempt(row.id);
        await record(actor, 'webhook.tested', id);
        return toDelivery(await deliveryById(sql, id, row.id));
      }
      const original = await deliveryById(sql, id, body.deliveryId);
      const row = await insertDelivery(sql, {
        webhookId: id,
        event: original.event,
        eventId: original.event_id,
        envelope: original.envelope,
        maxAttempts: settings.maxAttempts,
        redeliveryOf: original.id,
      });
      await deps.jobs.enqueue(WEBHOOK_DELIVER_JOB, { deliveryId: row.id }, { key: `${row.id}:1` });
      await record(actor, 'webhook.redelivered', id, undefined, { deliveryId: original.id });
      return toDelivery(row);
    },
  };
}

export type WebhookAdmin = ReturnType<typeof createWebhookAdmin>;
