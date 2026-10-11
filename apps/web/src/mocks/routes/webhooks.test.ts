import type { Webhook, WebhookDelivery } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { createMockApi } from '../dispatch.ts';
import { WEBHOOK_IDS } from '../seed/webhooks.ts';

/* The webhooks mock answers as the server's webhooks service does. */

const W = 'http://mock.local/api/v1/admin/webhooks';

const list = (api: ReturnType<typeof createMockApi>) =>
  (api.dispatch('GET', W, undefined)?.body as { items: Webhook[] }).items;

const deliveries = (api: ReturnType<typeof createMockApi>, id: string, query = '') =>
  api.dispatch('GET', `${W}/${id}/deliveries${query}`, undefined)?.body as {
    items: WebhookDelivery[];
    nextCursor: string | null;
  };

describe('the webhooks mock', () => {
  it('seeds a healthy, a paused and a failing webhook, and never lists a secret', () => {
    const api = createMockApi('ready');
    const rows = list(api);
    expect(rows.map((row) => row.status)).toEqual(['active', 'paused', 'failing']);
    expect(rows.find((row) => row.status === 'failing')?.disabledReason).toMatch(/503/);
    expect(rows.some((row) => 'secret' in row)).toBe(false);
  });

  it('answers a create with the secret once, and refuses a bad URL', () => {
    const api = createMockApi('ready');
    const bad = api.dispatch('POST', W, { name: 'Ops', url: 'ftp://x', events: ['issue.created'] });
    expect(bad?.status).toBe(400);
    const created = api.dispatch('POST', W, {
      name: 'Ops',
      url: 'https://ops.acmelabs.dev/in',
      events: ['issue.created'],
    });
    expect(created?.status).toBe(201);
    const body = created?.body as Webhook & { secret: string };
    expect(body.secret).toMatch(/^whsec_/);
    expect(body.secretHint).toBe(body.secret.slice(-4));
    const fetched = api.dispatch('GET', `${W}/${body.id}`, undefined)?.body as Webhook;
    expect('secret' in fetched).toBe(false);
  });

  it('turns a failing webhook back on and clears its failures', () => {
    const api = createMockApi('ready');
    const on = api.dispatch('PATCH', `${W}/${WEBHOOK_IDS.billing}`, { enabled: true });
    expect(on?.body).toMatchObject({
      status: 'active',
      consecutiveFailures: 0,
      disabledReason: null,
    });
  });

  it('answers a ping with a finished delivery and redelivers through the queue', () => {
    const api = createMockApi('ready');
    const ping = api.dispatch('POST', `${W}/${WEBHOOK_IDS.chat}/deliveries`, { kind: 'ping' });
    expect(ping?.body).toMatchObject({ event: 'ping', status: 'succeeded', responseStatus: 200 });
    const failed = deliveries(api, WEBHOOK_IDS.billing, '?status=failed').items[0]!;
    const queued = api.dispatch('POST', `${W}/${WEBHOOK_IDS.billing}/deliveries`, {
      kind: 'redelivery',
      deliveryId: failed.id,
    })?.body as WebhookDelivery;
    expect(queued).toMatchObject({ status: 'pending', redeliveryOf: failed.id });
    const after = deliveries(api, WEBHOOK_IDS.billing).items.find((row) => row.id === queued.id);
    expect(after?.status).toBe('succeeded');
  });

  it('pages the delivery log by keyset and filters it by status', () => {
    const api = createMockApi('ready');
    const first = deliveries(api, WEBHOOK_IDS.chat);
    expect(first.items).toHaveLength(25);
    const next = deliveries(api, WEBHOOK_IDS.chat, `?cursor=${first.nextCursor}`);
    expect(next.nextCursor).toBeNull();
    expect(deliveries(api, WEBHOOK_IDS.chat, '?status=retrying').items).toHaveLength(1);
  });

  it('keeps webhooks to people who manage workspace settings', () => {
    const api = createMockApi('member');
    expect(api.dispatch('GET', W, undefined)?.status).toBe(403);
    const targets = api.dispatch('GET', 'http://mock.local/api/v1/webhook-targets', undefined);
    expect(targets?.status).toBe(200);
  });
});
