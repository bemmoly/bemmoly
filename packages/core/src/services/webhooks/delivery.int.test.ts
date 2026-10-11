import { NOTIFICATION_EVENT_KINDS } from '@bemmoly/shared';
import { WEBHOOK_HEADERS } from '@bemmoly/shared/webhooks';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../contracts/event-bus.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import {
  startWebhooksHarness,
  type WebhooksHarness,
  type WebhooksWired,
} from '../../testing/webhooks-harness.ts';
import { WEBHOOK_DELIVER_JOB } from './context.ts';

const issueCreated = (key = 'PLT-12'): DomainEvent => ({
  kind: 'issue.created',
  occurredAt: new Date('2026-10-11T08:59:00Z'),
  actor: { kind: 'user', id: 'u-1', userId: 'u-1' },
  entity: { kind: 'issue', id: '0199c7a0-0000-7000-8000-000000000001' },
  payload: { summary: `${key} Fix the login was created`, url: `/work/issue/${key}`, key },
});

describe('webhook delivery against Postgres', () => {
  let database: TestDatabase;
  let h: WebhooksHarness;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (database.available) h = await startWebhooksHarness(database);
  });
  afterAll(async () => {
    if (!database.available) return;
    await h.stop();
    await database.stop();
  });
  beforeEach(async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    await h.reset();
  });

  async function hook(wired: WebhooksWired, overrides: Record<string, unknown> = {}) {
    return wired.service.create(h.admin, {
      name: 'Deploys',
      url: h.receiver.url(),
      events: ['issue.created', 'sprint.completed'],
      ...overrides,
    });
  }

  const deliveries = (webhookId: string) =>
    h.sql<
      { status: string; attempt: number; next_attempt_at: Date | null; error: string | null }[]
    >`
      select status, attempt, next_attempt_at, error from webhook_deliveries
      where webhook_id = ${webhookId} order by id`;

  it('queues one delivery per matching webhook inside the publisher’s transaction', async () => {
    const wired = h.wire();
    const listening = await hook(wired);
    const other = await hook(wired, { events: ['page.published'] });
    const paused = await hook(wired, { enabled: false });
    await h.sql
      .begin(async (tx) => {
        await wired.events.publish({ ...issueCreated(), transaction: tx });
        throw new Error('roll back');
      })
      .catch(() => undefined);
    expect(await deliveries(listening.id)).toHaveLength(0);
    // The fake queue keeps what pg-boss would have rolled back with the transaction.
    expect(wired.jobs.queued[0]?.options.transaction).toBeDefined();
    wired.jobs.queued.length = 0;

    await wired.events.publish(issueCreated());
    expect(await deliveries(listening.id)).toHaveLength(1);
    expect(await deliveries(other.id)).toHaveLength(0);
    expect(await deliveries(paused.id)).toHaveLength(0);
    expect(wired.jobs.queued.map((job) => job.name)).toEqual([WEBHOOK_DELIVER_JOB]);

    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    const [request] = h.receiver.received;
    expect(request?.headers[WEBHOOK_HEADERS.event]).toBe('issue.created');
    expect(JSON.parse(request!.body)).toMatchObject({
      version: '1',
      event: 'issue.created',
      summary: 'PLT-12 Fix the login was created',
      url: 'https://bemmoly.example.com/work/issue/PLT-12',
      actor: { kind: 'user', id: 'u-1' },
      entity: { kind: 'issue' },
      data: { key: 'PLT-12' },
    });
    expect((await deliveries(listening.id))[0]).toMatchObject({ status: 'succeeded', attempt: 1 });
  });

  it('retries with exponential backoff, then gives up after the last attempt', async () => {
    const wired = h.wire({ tuning: { maxAttempts: 4, autoDisableAfter: 99 } });
    const created = await hook(wired);
    h.receiver.fallback = { status: 500, body: 'boom' };
    await wired.events.publish(issueCreated());
    const gaps: number[] = [];
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const [job] = wired.jobs.queued;
      if (attempt > 1) {
        const after = job?.options.startAfter as Date;
        gaps.push((after.getTime() - h.clock.now.getTime()) / 1000);
      }
      await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    }
    expect(gaps).toEqual([30, 120, 480]);
    expect(h.receiver.received).toHaveLength(4);
    expect(h.receiver.received.map((r) => r.headers['bemmoly-attempt'])).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
    const [row] = await deliveries(created.id);
    expect(row).toMatchObject({ status: 'failed', attempt: 4, next_attempt_at: null });
    expect(row?.error).toBe('The receiver answered 500');
    expect(wired.jobs.queued).toHaveLength(0);
    expect((await wired.service.get(h.admin, created.id)).consecutiveFailures).toBe(1);
  });

  it('recovers on a retry and clears the failure count', async () => {
    const wired = h.wire();
    const created = await hook(wired);
    h.receiver.answers.push({ status: 503 });
    await wired.events.publish(issueCreated());
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    expect((await deliveries(created.id))[0]).toMatchObject({ status: 'retrying', attempt: 1 });
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    expect((await deliveries(created.id))[0]).toMatchObject({ status: 'succeeded', attempt: 2 });
    expect((await wired.service.get(h.admin, created.id)).consecutiveFailures).toBe(0);
  });

  it('turns itself off after repeated failed deliveries and tells the admins', async () => {
    const wired = h.wire({ tuning: { maxAttempts: 1, autoDisableAfter: 2 } });
    const created = await hook(wired);
    h.receiver.fallback = { status: 410 };
    await wired.events.publish(issueCreated('PLT-1'));
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    expect((await wired.service.get(h.admin, created.id)).status).toBe('active');
    await wired.events.publish(issueCreated('PLT-2'));
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);

    const after = await wired.service.get(h.admin, created.id);
    expect(after).toMatchObject({ enabled: false, status: 'failing', consecutiveFailures: 2 });
    expect(after.disabledReason).toBe('Turned off after 2 failed deliveries in a row');
    const told = wired.published.filter(
      (event) => event.kind === NOTIFICATION_EVENT_KINDS.notificationRequested,
    );
    expect(told).toHaveLength(1);
    expect(told[0]?.payload).toMatchObject({
      kind: 'webhook_disabled',
      recipientIds: [h.adminId],
      target: { kind: 'webhook', id: created.id, label: 'Deploys', url: '/settings/webhooks' },
    });
    const [audit] = await h.sql<{ actor_kind: string; action: string }[]>`
      select actor_kind, action from audit_log
      where target_id = ${created.id} and action = 'webhook.disabled'`;
    expect(audit).toEqual({ actor_kind: 'system', action: 'webhook.disabled' });

    // Off now: new events queue nothing, and a queued one is not sent.
    await wired.events.publish(issueCreated('PLT-3'));
    expect(wired.jobs.queued).toHaveLength(0);
    expect(h.receiver.received).toHaveLength(2);
  });

  it('refuses a private target at send time when private URLs are not allowed', async () => {
    const created = await hook(h.wire());
    const strict = h.wire({ allowPrivateUrls: false });
    await strict.events.publish(issueCreated());
    await strict.jobs.runAll(WEBHOOK_DELIVER_JOB);
    const [row] = await deliveries(created.id);
    expect(row?.status).toBe('retrying');
    expect(row?.error).toMatch(/resolves to the private address 127\.0\.0\.1/);
    expect(h.receiver.received).toHaveLength(0);
  });

  it('never follows a redirect and gives up on a receiver that hangs', async () => {
    const wired = h.wire({ timeoutMs: 300 });
    const created = await hook(wired);
    h.receiver.answers.push({ redirect: 'http://169.254.169.254/latest/meta-data' });
    h.receiver.answers.push({ hang: true });
    await wired.events.publish(issueCreated());
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    expect((await deliveries(created.id))[0]?.error).toBe(
      'The receiver answered with a redirect, which is never followed',
    );
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    expect((await deliveries(created.id))[0]?.error).toBe(
      'The receiver did not answer within 0.3 seconds',
    );
    expect(h.receiver.received).toHaveLength(2);
  });

  it('redelivers an earlier delivery with the same event id', async () => {
    const wired = h.wire({ tuning: { maxAttempts: 1 } });
    const created = await hook(wired);
    h.receiver.answers.push({ status: 500 });
    await wired.events.publish(issueCreated());
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    const page = await wired.service.deliveries(h.admin, created.id, { limit: 10 });
    const failed = page.items[0]!;
    expect(failed.status).toBe('failed');
    const again = await wired.service.deliver(h.admin, created.id, {
      kind: 'redelivery',
      deliveryId: failed.id,
    });
    expect(again).toMatchObject({
      status: 'pending',
      eventId: failed.eventId,
      redeliveryOf: failed.id,
    });
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    const [first, second] = h.receiver.received;
    expect(JSON.parse(second!.body).id).toBe(JSON.parse(first!.body).id);
    const failedOnly = await wired.service.deliveries(h.admin, created.id, {
      limit: 10,
      status: 'failed',
    });
    expect(failedOnly.items.map((item) => item.id)).toEqual([failed.id]);
  });

  it('fills a chat preset and delivers an automation request', async () => {
    const wired = h.wire();
    const created = await hook(wired, { format: 'chat_text', events: ['sprint.completed'] });
    await wired.events.publish({
      kind: 'webhook.requested',
      occurredAt: new Date(),
      actor: { kind: 'automation', id: 'rule-1', userId: h.adminId, chain: ['rule-0'] },
      payload: {
        webhookId: created.id,
        summary: 'PLT-7 moved to Done',
        url: '/work/issue/PLT-7',
        data: { rule: 'Ship it' },
      },
    });
    await wired.jobs.runAll(WEBHOOK_DELIVER_JOB);
    const [request] = h.receiver.received;
    expect(request?.headers[WEBHOOK_HEADERS.event]).toBe('automation.triggered');
    expect(JSON.parse(request!.body)).toEqual({
      text: 'PLT-7 moved to Done\nhttps://bemmoly.example.com/work/issue/PLT-7',
    });
  });
});
