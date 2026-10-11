import { verifyWebhookSignature } from '@bemmoly/core';
import { startWebhookReceiver, type WebhookReceiver } from '@bemmoly/core/testing';
import { WEBHOOK_HEADERS } from '@bemmoly/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startBootHarness, type BootHarness, type SignedInApp } from './boot-harness.ts';

/*
 * Outgoing webhooks and Work automation through the real host: routes, the pg-boss jobs,
 * the event subscriptions and a local receiver. Private addresses are allowed here, as an
 * operator would for a receiver on the same network.
 */

async function until<T>(read: () => Promise<T>, ok: (value: T) => boolean, ms = 30_000) {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (ok(value)) return value;
    if (Date.now() > deadline) throw new Error(`timed out; last value ${JSON.stringify(value)}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

describe('webhooks and automation in the host', () => {
  let harness: BootHarness | undefined;
  let skipReason = '';
  let app: SignedInApp;
  let receiver: WebhookReceiver;

  const call = async (method: string, url: string, payload?: unknown) => {
    const response = await app.inject({
      method: method as 'GET',
      url: `/api/v1${url}`,
      ...(payload !== undefined ? { payload: payload as object } : {}),
    });
    return { status: response.statusCode, body: response.body ? response.json() : null };
  };

  beforeAll(async () => {
    const started = await startBootHarness();
    if (!started.available) {
      skipReason = started.reason;
      return;
    }
    harness = started.harness;
    receiver = await startWebhookReceiver();
    app = await harness.boot('', { BEMMOLY_ALLOW_PRIVATE_URLS: 'true' });
    const enabled = await call('POST', '/admin/modules/work/enable', {
      access: { mode: 'everyone' },
    });
    expect(enabled.status).toBe(200);
  });

  afterAll(async () => {
    await receiver?.close();
    await harness?.stop();
  });

  it('delivers signed events and runs a rule that sends a webhook', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await call('POST', '/admin/webhooks', {
      name: 'Deploy bot',
      url: receiver.url(),
      events: ['issue.created'],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const secret = created.body.secret as string;
    const read = await call('GET', `/admin/webhooks/${created.body.id}`);
    expect(read.body).not.toHaveProperty('secret');

    const project = await call('POST', '/work/projects', { key: 'HK', name: 'Hooks' });
    const rule = await call('POST', '/work/automation/rules', {
      name: 'Triage and tell the bot',
      projectId: project.body.id,
      enabled: true,
      trigger: { name: 'issue_created' },
      actions: [
        { name: 'add_label', args: { label: 'triage' } },
        { name: 'send_webhook', args: { webhookId: created.body.id } },
      ],
    });
    expect(rule.status, JSON.stringify(rule.body)).toBe(201);
    expect(rule.body.ownerName).toBe('Rohan S.');

    const types = (await call('GET', '/work/projects/HK/issue-types')).body.items as {
      id: string;
      key: string;
    }[];
    const issue = await call('POST', '/work/issues', {
      projectId: project.body.id,
      typeId: types.find((type) => type.key === 'task')?.id,
      title: 'Wire the pager',
    });
    expect(issue.status).toBe(201);

    const runs = await until(
      () => call('GET', `/work/automation/runs?projectId=${project.body.id}`),
      (page) => page.body.items[0]?.status === 'succeeded',
    );
    expect(runs.body.items[0]).toMatchObject({ trigger: 'issue.created', issueKey: 'HK-1' });
    await until(
      async () => receiver.received.length,
      (count) => count >= 2,
    );
    const events = receiver.received.map((request) => request.headers[WEBHOOK_HEADERS.event]);
    expect(events.sort()).toEqual(['automation.triggered', 'issue.created']);
    for (const request of receiver.received) {
      const signature = String(request.headers[WEBHOOK_HEADERS.signature]);
      expect(verifyWebhookSignature(secret, signature, request.body)).toBe(true);
    }
    const body = JSON.parse(
      receiver.received.find((r) => r.headers[WEBHOOK_HEADERS.event] === 'issue.created')!.body,
    );
    expect(body).toMatchObject({
      version: '1',
      event: 'issue.created',
      summary: 'HK-1 Wire the pager was created',
      url: 'http://localhost:8080/work/issue/HK-1',
      data: { issue: { key: 'HK-1' } },
    });

    const deliveries = await until(
      () => call('GET', `/admin/webhooks/${created.body.id}/deliveries`),
      (page) => page.body.items.every((item: { status: string }) => item.status === 'succeeded'),
    );
    expect(deliveries.body.items).toHaveLength(2);
    const audit = await call('GET', `/audit-log?targetKind=issue&action=automation.add_label`);
    expect(audit.body.items[0]).toMatchObject({ actorKind: 'automation', actorId: rule.body.id });
  });

  it('tests, rotates, refuses bad targets and deletes over HTTP', async (ctx) => {
    if (!harness) return ctx.skip(skipReason);
    const created = await call('POST', '/admin/webhooks', {
      name: 'Chat',
      url: receiver.url('/chat'),
      events: ['sprint.completed'],
      format: 'chat_text',
    });
    const ping = await call('POST', `/admin/webhooks/${created.body.id}/deliveries`, {
      kind: 'ping',
    });
    expect(ping.status).toBe(201);
    expect(ping.body).toMatchObject({ event: 'ping', status: 'succeeded', responseStatus: 200 });
    const rotated = await call('POST', `/admin/webhooks/${created.body.id}/secrets`);
    expect(rotated.status).toBe(201);
    expect(rotated.body.secret).not.toBe(created.body.secret);
    const bad = await call('POST', '/admin/webhooks', {
      name: 'Bad',
      url: 'ftp://example.com/hooks',
      events: ['issue.created'],
    });
    expect(bad.status).toBe(400);
    const catalog = await call('GET', '/admin/webhook-catalog');
    expect(catalog.body.formats.map((format: { id: string }) => format.id)).toEqual([
      'json',
      'chat_text',
      'chat_blocks',
      'chat_card',
    ]);
    const targets = await call('GET', '/webhook-targets');
    expect(targets.body.items.map((item: { name: string }) => item.name)).toContain('Chat');
    expect((await call('DELETE', `/admin/webhooks/${created.body.id}`)).status).toBe(204);
    expect((await call('GET', `/admin/webhooks/${created.body.id}`)).status).toBe(404);
  });
});
