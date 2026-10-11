import { ForbiddenError, ValidationError, WEBHOOK_HEADERS } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import { startWebhooksHarness, type WebhooksHarness } from '../../testing/webhooks-harness.ts';
import { verifyWebhookSignature } from './signing.ts';

describe('webhook administration against Postgres', () => {
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

  const body = (url: string) => ({ name: 'Deploys', url, events: ['issue.created' as const] });

  it('shows the secret once, keeps it sealed, and audits the change', async () => {
    const { service } = h.wire();
    const created = await service.create(h.admin, body(h.receiver.url()));
    expect(created.secret).toMatch(/^whsec_/);
    expect(created.secretHint).toBe(created.secret.slice(-4));
    const read = await service.get(h.admin, created.id);
    expect(read).not.toHaveProperty('secret');
    const [row] = await h.sql<{ secret_sealed: string }[]>`
      select secret_sealed from webhooks where id = ${created.id}`;
    expect(row?.secret_sealed).not.toContain(created.secret);
    const audit = await h.sql<{ action: string; actor_user_id: string; after: unknown }[]>`
      select action, actor_user_id, after from audit_log where target_id = ${created.id}`;
    expect(audit).toEqual([
      expect.objectContaining({ action: 'webhook.created', actor_user_id: h.adminId }),
    ]);
    expect(JSON.stringify(audit)).not.toContain(created.secret);
  });

  it('lets only people with workspace.settings.manage manage webhooks', async () => {
    const { service } = h.wire();
    await expect(service.list(h.member)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.create(h.member, body(h.receiver.url()))).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    const created = await service.create(h.admin, body(h.receiver.url()));
    await expect(service.rotateSecret(h.member, created.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.deliver(h.member, created.id, { kind: 'ping' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    // The rule builder's picker: names only, for anyone signed in.
    expect(await service.targets(h.member)).toEqual([
      { id: created.id, name: 'Deploys', enabled: true },
    ]);
  });

  it('refuses private, loopback and link-local targets unless private URLs are allowed', async () => {
    const { service } = h.wire({ allowPrivateUrls: false });
    for (const url of [
      'http://127.0.0.1:9/hooks',
      'http://10.1.2.3/hooks',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/hooks',
      'http://192.168.1.20/hooks',
    ]) {
      const error = await service.create(h.admin, body(url)).catch((caught: unknown) => caught);
      expect(error, url).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toMatchObject({ issues: [{ path: 'url' }] });
    }
    const created = await service.create(h.admin, body('https://93.184.215.14/hooks'));
    await expect(
      service.update(h.admin, created.id, { url: 'http://127.0.0.1/hooks' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('sends a signed test delivery and answers with its outcome', async () => {
    const { service } = h.wire();
    const created = await service.create(h.admin, body(h.receiver.url()));
    h.clock.now = new Date();
    const delivery = await service.deliver(h.admin, created.id, { kind: 'ping' });
    expect(delivery).toMatchObject({
      event: 'ping',
      status: 'succeeded',
      attempt: 1,
      maxAttempts: 1,
      responseStatus: 200,
      responseExcerpt: 'ok',
    });
    const [request] = h.receiver.received;
    const signature = String(request?.headers[WEBHOOK_HEADERS.signature]);
    expect(verifyWebhookSignature(created.secret, signature, request!.body)).toBe(true);
    expect(verifyWebhookSignature('whsec_wrong', signature, request!.body)).toBe(false);
    expect(request?.headers[WEBHOOK_HEADERS.event]).toBe('ping');
    expect(request?.headers[WEBHOOK_HEADERS.delivery]).toBe(delivery.id);
    expect(JSON.parse(request!.body)).toMatchObject({
      version: '1',
      event: 'ping',
      id: delivery.eventId,
      workspace: { url: 'https://bemmoly.example.com' },
    });
  });

  it('rotates the secret: the old one stops verifying at once', async () => {
    const { service } = h.wire();
    const created = await service.create(h.admin, body(h.receiver.url()));
    const rotated = await service.rotateSecret(h.admin, created.id);
    expect(rotated.secret).not.toBe(created.secret);
    h.clock.now = new Date();
    await service.deliver(h.admin, created.id, { kind: 'ping' });
    const [request] = h.receiver.received;
    const signature = String(request?.headers[WEBHOOK_HEADERS.signature]);
    expect(verifyWebhookSignature(rotated.secret, signature, request!.body)).toBe(true);
    expect(verifyWebhookSignature(created.secret, signature, request!.body)).toBe(false);
    const actions = await h.sql<{ action: string }[]>`
      select action from audit_log where target_id = ${created.id} order by id`;
    expect(actions.map((row) => row.action)).toEqual([
      'webhook.created',
      'webhook.secret_rotated',
      'webhook.tested',
    ]);
  });

  it('refuses a stale or tampered signature', () => {
    const secret = 'whsec_test';
    const now = new Date('2026-10-11T09:00:00Z');
    const t = Math.floor(now.getTime() / 1000);
    const header = `t=${t},v1=${'0'.repeat(64)}`;
    expect(verifyWebhookSignature(secret, header, '{}', { now })).toBe(false);
    expect(verifyWebhookSignature(secret, 'garbage', '{}', { now })).toBe(false);
  });

  it('turns a failing webhook back on with a clean count', async () => {
    const { service } = h.wire();
    const created = await service.create(h.admin, body(h.receiver.url()));
    await h.sql`
      update webhooks set enabled = false, disabled_reason = 'Turned off', consecutive_failures = 5
      where id = ${created.id}`;
    expect((await service.get(h.admin, created.id)).status).toBe('failing');
    const back = await service.update(h.admin, created.id, { enabled: true });
    expect(back).toMatchObject({ status: 'active', consecutiveFailures: 0, disabledReason: null });
    const paused = await service.update(h.admin, created.id, { enabled: false });
    expect(paused.status).toBe('paused');
    await service.remove(h.admin, created.id);
    await expect(service.get(h.admin, created.id)).rejects.toThrow('not found');
  });
});
