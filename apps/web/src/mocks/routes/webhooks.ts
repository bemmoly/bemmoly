import {
  createWebhookBodySchema,
  createWebhookDeliveryBodySchema,
  updateWebhookBodySchema,
  WEBHOOK_EVENTS,
  WEBHOOK_FORMATS,
  WEBHOOK_MAX_ATTEMPTS,
  type Webhook,
  type WebhookDelivery,
} from '@bemmoly/shared/webhooks';
import { audit, can, type MockDb } from '../db.ts';
import { newId } from '../seed/time.ts';
import { mockSecret, seedDeliveries, seedWebhooks, type StoredWebhook } from '../seed/webhooks.ts';
import { bodyOf, fail, invalid, notFound, ok, page, type MockRoute } from '../types.ts';

const ADMIN = '/api/v1/admin/webhooks';
const SETTINGS = 'workspace.settings.manage';

interface WebhookState {
  webhooks: StoredWebhook[];
  deliveries: WebhookDelivery[];
}

/** Beside the kernel's mock database, keyed by it, so a scenario reset starts them over. */
const states = new WeakMap<MockDb, WebhookState>();

export function webhookState(db: MockDb): WebhookState {
  let state = states.get(db);
  if (!state) {
    state = { webhooks: seedWebhooks(), deliveries: seedDeliveries() };
    states.set(db, state);
  }
  return state;
}

/** What the API sends: everything but the secret. */
const publicOf = ({ secret: _secret, ...webhook }: StoredWebhook): Webhook => webhook;

const withSecret = (webhook: StoredWebhook) => ({ ...publicOf(webhook), secret: webhook.secret });

const adminOnly =
  (handle: MockRoute['handle']): MockRoute['handle'] =>
  (request, db) =>
    can(db, SETTINGS)
      ? handle(request, db)
      : fail(403, 'forbidden', 'You need "Manage workspace settings" to manage webhooks.');

function refused(error: { issues: readonly { path: PropertyKey[]; message: string }[] }) {
  const issue = error.issues[0];
  return invalid(String(issue?.path[0] ?? 'name'), issue?.message ?? 'Invalid value');
}

const find = (db: MockDb, id: string | undefined) =>
  webhookState(db).webhooks.find((webhook) => webhook.id === id);

/** A host under `.invalid` is unreachable, so a test send can show a failure too. */
function attempt(webhook: StoredWebhook) {
  const host = new URL(webhook.url).hostname;
  if (host.endsWith('.invalid')) {
    return { ok: false, code: null, ms: 3_000, error: `Could not reach ${host}.`, excerpt: null };
  }
  return {
    ok: true,
    code: 200,
    ms: 140 + (webhook.name.length % 7) * 23,
    error: null,
    excerpt: 'ok',
  };
}

function send(webhook: StoredWebhook, event: string, redeliveryOf: string | null) {
  const result = attempt(webhook);
  const now = new Date().toISOString();
  const delivery: WebhookDelivery = {
    id: newId(),
    webhookId: webhook.id,
    event,
    eventId: newId(),
    status: result.ok ? 'succeeded' : 'failed',
    attempt: 1,
    maxAttempts: event === 'ping' ? 1 : WEBHOOK_MAX_ATTEMPTS,
    responseStatus: result.code,
    responseExcerpt: result.excerpt,
    error: result.error,
    durationMs: result.ms,
    nextAttemptAt: null,
    redeliveryOf,
    createdAt: now,
    deliveredAt: now,
  };
  webhook.lastDeliveryAt = now;
  return delivery;
}

/** A queued redelivery goes out the next time the log is read, as the worker would. */
function drain(db: MockDb, webhookId: string) {
  for (const delivery of webhookState(db).deliveries) {
    if (delivery.webhookId !== webhookId || delivery.status !== 'pending') continue;
    const webhook = find(db, webhookId);
    if (!webhook) continue;
    Object.assign(delivery, {
      ...send(webhook, delivery.event, delivery.redeliveryOf),
      id: delivery.id,
    });
  }
}

export const webhookRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/webhook-catalog',
    handle: adminOnly(() => ok({ events: WEBHOOK_EVENTS, formats: WEBHOOK_FORMATS })),
  },
  {
    method: 'GET',
    pattern: '/api/v1/webhook-targets',
    handle: (_, db) =>
      ok({
        items: webhookState(db).webhooks.map(({ id, name, enabled }) => ({ id, name, enabled })),
      }),
  },
  {
    method: 'GET',
    pattern: ADMIN,
    handle: adminOnly((_, db) => ok({ items: webhookState(db).webhooks.map(publicOf) })),
  },
  {
    method: 'POST',
    pattern: ADMIN,
    handle: adminOnly((request, db) => {
      const parsed = createWebhookBodySchema.safeParse(bodyOf(request));
      if (!parsed.success) return refused(parsed.error);
      const now = new Date().toISOString();
      const secret = mockSecret(newId().slice(-6));
      const webhook: StoredWebhook = {
        id: newId(),
        ...parsed.data,
        status: parsed.data.enabled ? 'active' : 'paused',
        disabledReason: null,
        consecutiveFailures: 0,
        secret,
        secretHint: secret.slice(-4),
        lastDeliveryAt: null,
        createdAt: now,
        updatedAt: now,
      };
      webhookState(db).webhooks.unshift(webhook);
      audit(db, 'webhook.created', 'webhook', webhook.id);
      return ok(withSecret(webhook), 201);
    }),
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/:id`,
    handle: adminOnly((request, db) => {
      const webhook = find(db, request.params['id']);
      return webhook ? ok(publicOf(webhook)) : notFound('Webhook');
    }),
  },
  {
    method: 'PATCH',
    pattern: `${ADMIN}/:id`,
    handle: adminOnly((request, db) => {
      const webhook = find(db, request.params['id']);
      if (!webhook) return notFound('Webhook');
      const parsed = updateWebhookBodySchema.safeParse(bodyOf(request));
      if (!parsed.success) return refused(parsed.error);
      Object.assign(webhook, parsed.data, { updatedAt: new Date().toISOString() });
      if (parsed.data.enabled === true) {
        Object.assign(webhook, { status: 'active', consecutiveFailures: 0, disabledReason: null });
      } else if (parsed.data.enabled === false && webhook.status !== 'failing') {
        webhook.status = 'paused';
      }
      audit(db, 'webhook.updated', 'webhook', webhook.id);
      return ok(publicOf(webhook));
    }),
  },
  {
    method: 'DELETE',
    pattern: `${ADMIN}/:id`,
    handle: adminOnly((request, db) => {
      const state = webhookState(db);
      const webhook = find(db, request.params['id']);
      if (!webhook) return notFound('Webhook');
      state.webhooks = state.webhooks.filter((row) => row !== webhook);
      state.deliveries = state.deliveries.filter((row) => row.webhookId !== webhook.id);
      audit(db, 'webhook.deleted', 'webhook', webhook.id);
      return ok();
    }),
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/:id/secrets`,
    handle: adminOnly((request, db) => {
      const webhook = find(db, request.params['id']);
      if (!webhook) return notFound('Webhook');
      webhook.secret = mockSecret(newId().slice(-6));
      webhook.secretHint = webhook.secret.slice(-4);
      webhook.updatedAt = new Date().toISOString();
      audit(db, 'webhook.secret_rotated', 'webhook', webhook.id);
      return ok(withSecret(webhook), 201);
    }),
  },
  {
    method: 'GET',
    pattern: `${ADMIN}/:id/deliveries`,
    handle: adminOnly((request, db) => {
      const webhook = find(db, request.params['id']);
      if (!webhook) return notFound('Webhook');
      drain(db, webhook.id);
      const status = request.query.get('status');
      const rows = webhookState(db)
        .deliveries.filter((row) => row.webhookId === webhook.id)
        .filter((row) => !status || row.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return ok(page(rows, request, 25));
    }),
  },
  {
    method: 'POST',
    pattern: `${ADMIN}/:id/deliveries`,
    handle: adminOnly((request, db) => {
      const webhook = find(db, request.params['id']);
      if (!webhook) return notFound('Webhook');
      const parsed = createWebhookDeliveryBodySchema.safeParse(bodyOf(request));
      if (!parsed.success) return refused(parsed.error);
      const state = webhookState(db);
      if (parsed.data.kind === 'ping') {
        const delivery = send(webhook, 'ping', null);
        state.deliveries.unshift(delivery);
        return ok(delivery, 201);
      }
      const { deliveryId } = parsed.data;
      const earlier = state.deliveries.find(
        (row) => row.id === deliveryId && row.webhookId === webhook.id,
      );
      if (!earlier) return notFound('Delivery');
      const queued: WebhookDelivery = {
        ...earlier,
        id: newId(),
        status: 'pending',
        attempt: 0,
        responseStatus: null,
        responseExcerpt: null,
        error: null,
        durationMs: null,
        nextAttemptAt: new Date().toISOString(),
        redeliveryOf: earlier.id,
        createdAt: new Date().toISOString(),
        deliveredAt: null,
      };
      state.deliveries.unshift(queued);
      return ok(queued, 201);
    }),
  },
];
