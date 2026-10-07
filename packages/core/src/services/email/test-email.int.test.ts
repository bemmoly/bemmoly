import type { AddressInfo } from 'node:net';
import { SMTPServer } from 'smtp-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from '../../testing/email-notifications-harness.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';

describe('POST /api/v1/admin/email/test over SMTP', () => {
  let database: TestDatabase;
  let h: Harness;
  let smtp: SMTPServer;
  let adminId = '';
  const delivered: string[] = [];

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) return;
    h = await startHarness(database, () => [adminId]);
    adminId = (await h.addUser('Rohan', 'rohan@acme.test')).id;
    smtp = new SMTPServer({
      disabledCommands: ['STARTTLS'],
      allowInsecureAuth: true,
      onAuth: (auth, _session, callback) =>
        auth.password === 'right'
          ? callback(null, { user: auth.username })
          : callback(new Error('Invalid username or password')),
      onData(stream, session, callback) {
        stream.resume();
        stream.on('end', () => {
          delivered.push(...session.envelope.rcptTo.map((rcpt) => rcpt.address));
          callback();
        });
      },
    });
    await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
    h.settings.put('email.provider', 'smtp');
    h.settings.put('email.smtp.host', '127.0.0.1');
    h.settings.put('email.smtp.port', (smtp.server.address() as AddressInfo).port);
    h.settings.put('email.smtp.security', 'none');
    h.settings.put('email.smtp.username', 'mailer');
  });

  afterAll(async () => {
    if (!database.available) return;
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    await h.stop();
    await database.stop();
  });

  const test = () =>
    h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/email/test',
      headers: { 'x-test-user': adminId },
      payload: {},
    });

  it('reports a rejected password in plain words and records the failure', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    h.settings.put('email.smtp.password', 'wrong');
    const response = await test();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      sent: false,
      provider: 'smtp',
      to: 'rohan@acme.test',
      failure: { stage: 'auth', message: 'The mail server rejected the username or password.' },
      deliverability: {
        domain: 'bemmoly.example.com',
        spf: {
          status: 'missing',
          suggested: { host: 'bemmoly.example.com', value: 'v=spf1 a mx ~all' },
        },
        dmarc: { status: 'missing', suggested: { host: '_dmarc.bemmoly.example.com' } },
      },
    });
    const overview = await h.app.inject({
      url: '/api/v1/admin/email/outbox',
      headers: { 'x-test-user': adminId },
    });
    expect(overview.json()).toMatchObject({
      counts: { failed: 1 },
      failures: {
        count: 1,
        topReason: expect.stringContaining('rejected the username or password'),
      },
    });
  });

  it('delivers once the password is right', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    h.settings.put('email.smtp.password', 'right');
    const response = await test();
    expect(response.json()).toMatchObject({ sent: true, failure: null });
    expect(delivered).toEqual(['rohan@acme.test']);
  });

  it('is for admins only', async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const other = await h.addUser('Lena T.', 'lena@acme.test');
    const response = await h.app.inject({
      method: 'POST',
      url: '/api/v1/admin/email/test',
      headers: { 'x-test-user': other.id },
      payload: {},
    });
    expect(response.statusCode).toBe(403);
  });
});
