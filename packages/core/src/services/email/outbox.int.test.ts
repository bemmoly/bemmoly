import { ForbiddenError, NotFoundError, ProviderError } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage, EmailSender } from '../../contracts/email-sender.ts';
import { userActor } from '../../testing/fakes.ts';
import {
  EMAIL_CHANGESET_IDS,
  startHarness,
  type Harness,
} from '../../testing/email-notifications-harness.ts';
import { kernelChangelogRunner } from '../../testing/kernel-changelog.ts';
import { startTestDatabase, type TestDatabase } from '../../testing/postgres.ts';
import {
  createEmailService,
  EMAIL_SEND_JOB,
  registerEmailJobs,
  type EmailService,
} from './index.ts';

type Behaviour = 'ok' | 'transient' | 'permanent';

function scriptedSender(script: Behaviour[], sent: EmailMessage[]): EmailSender {
  return {
    id: 'scripted',
    async verify() {},
    async send(message) {
      const next = script.shift() ?? 'ok';
      if (next === 'ok') {
        sent.push(message);
        return { messageId: `m-${sent.length}`, accepted: [], rejected: [] };
      }
      throw new ProviderError(next === 'transient' ? 'Server busy' : 'Mailbox does not exist', {
        provider: 'scripted',
        details: {
          stage: next === 'transient' ? 'connect' : 'send',
          serverResponse: next === 'transient' ? '421 try later' : '550 no such user',
          transient: next === 'transient',
        },
      });
    },
  };
}

const newEmail = (dedupeKey: string | null = null) => ({
  kind: 'test',
  toAddress: 'rohan@acme.test',
  toName: 'Rohan',
  subject: 'Hello',
  html: '<p>Hello</p>',
  text: 'Hello',
  headers: { 'X-Test': '1' },
  dedupeKey,
});

describe('email outbox against Postgres', () => {
  let database: TestDatabase;
  let harness: Harness;
  let email: EmailService;
  const script: Behaviour[] = [];
  const sent: EmailMessage[] = [];
  let adminId = '';

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) return;
    harness = await startHarness(database, () => [adminId]);
    adminId = (await harness.addUser('Rohan', 'rohan@acme.test')).id;
    email = createEmailService({
      db: harness.sql,
      settings: harness.settings,
      jobs: harness.jobs,
      authorize: async (actor) => {
        if (actor.id !== adminId) throw new ForbiddenError();
      },
      users: { findByIds: async () => harness.users },
      logger: (await import('../../testing/fakes.ts')).silentLogger,
      publicUrl: 'https://bemmoly.example.com',
      secretKey: Buffer.alloc(32, 3).toString('base64'),
      allowPrivateHosts: true,
      senderFor: () => scriptedSender(script, sent),
      drainPolicy: { maxAttempts: 3, leaseSeconds: 60, batchSize: 10, sweepLimit: 100 },
    });
    registerEmailJobs(harness.jobs, email);
  });

  afterAll(async () => {
    if (!database.available) return;
    await harness.stop();
    await database.stop();
  });

  beforeEach(async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    await harness.sql`truncate email_outbox`;
    harness.jobs.queued.length = 0;
    script.length = 0;
    sent.length = 0;
  });

  const rowOf = async (id: string) => {
    const [row] = await harness.sql<
      {
        status: string;
        attempts: number;
        last_error: string | null;
        sent_at: string | null;
        provider: string | null;
        due_in: number;
      }[]
    >`select status, attempts, last_error, sent_at, provider,
             extract(epoch from next_attempt_at - now())::int as due_in
        from email_outbox where id = ${id}`;
    return row;
  };
  const makeDue = (id: string) =>
    harness.sql`update email_outbox set next_attempt_at = now() where id = ${id}`;

  it('writes the row, and enqueues its job, in the caller’s transaction', async () => {
    let rolledBack: unknown;
    await harness.sql
      .begin(async (tx) => {
        rolledBack = tx;
        await email.queue(tx, newEmail('rolled-back'));
        throw new Error('the change failed');
      })
      .catch(() => undefined);
    const [count] = await harness.sql<{ n: number }[]>`select count(*)::int as n from email_outbox`;
    expect(count?.n).toBe(0);
    // The real queue drops a job enqueued in a transaction that rolls back.
    expect(harness.jobs.queued[0]?.options.transaction).toBe(rolledBack);
    harness.jobs.queued.length = 0;

    const id = await harness.sql.begin((tx) => email.queue(tx, newEmail()));
    expect(await rowOf(id)).toMatchObject({ status: 'pending', attempts: 0 });
    expect(harness.jobs.queued).toMatchObject([
      {
        name: EMAIL_SEND_JOB,
        payload: { outboxId: id },
        options: { key: `email:${id}`, singleton: true },
      },
    ]);
  });

  it('ignores a second email with the same dedupe key', async () => {
    const first = await email.queue(harness.sql, newEmail('invite:1'));
    const second = await email.queue(harness.sql, newEmail('invite:1'));
    expect(second).toBe(first);
    expect(harness.jobs.queued).toHaveLength(1);
  });

  it('drains a queued email through the job and marks it sent', async () => {
    const id = await email.queue(harness.sql, newEmail());
    await harness.jobs.runAll(EMAIL_SEND_JOB);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      subject: 'Hello',
      idempotencyKey: id,
      headers: { 'X-Test': '1' },
    });
    expect(await rowOf(id)).toMatchObject({ status: 'sent', attempts: 1, provider: 'scripted' });
    const sentAt = (await rowOf(id))?.sent_at;
    expect(Number.isNaN(new Date(sentAt ?? '').getTime())).toBe(false);
  });

  it('retries a transient failure with backoff, then marks it failed after the last attempt', async () => {
    script.push('transient', 'transient', 'transient');
    const id = await email.queue(harness.sql, newEmail());
    await harness.jobs.runAll(EMAIL_SEND_JOB);
    const first = await rowOf(id);
    expect(first).toMatchObject({ status: 'pending', attempts: 1 });
    expect(first?.last_error).toBe('Server busy (server said: 421 try later)');
    expect(first?.due_in).toBeGreaterThan(20);
    expect(harness.jobs.queued[0]?.options).toMatchObject({ startAfter: 30 });

    await makeDue(id);
    await harness.jobs.runAll(EMAIL_SEND_JOB);
    expect(await rowOf(id)).toMatchObject({ status: 'pending', attempts: 2 });
    expect(harness.jobs.queued[0]?.options).toMatchObject({ startAfter: 120 });

    await makeDue(id);
    await harness.jobs.runAll(EMAIL_SEND_JOB);
    expect(await rowOf(id)).toMatchObject({ status: 'failed', attempts: 3 });
    expect(harness.jobs.queued).toHaveLength(0);
  });

  it('fails at once when the server refuses the address for good', async () => {
    script.push('permanent');
    const id = await email.queue(harness.sql, newEmail());
    await harness.jobs.runAll(EMAIL_SEND_JOB);
    expect(await rowOf(id)).toMatchObject({
      status: 'failed',
      attempts: 1,
      last_error: 'Mailbox does not exist (server said: 550 no such user)',
    });
  });

  it('reclaims a row whose sender died mid-send once its lease runs out', async () => {
    const id = await email.queue(harness.sql, newEmail());
    await harness.sql`update email_outbox set status = 'sending', attempts = 1,
                        next_attempt_at = now() - interval '1 second' where id = ${id}`;
    await email.drain({});
    expect(await rowOf(id)).toMatchObject({ status: 'sent', attempts: 2 });
  });

  it('shows admins counts and the last failures in plain words', async () => {
    script.push('ok', 'permanent', 'permanent');
    for (let i = 0; i < 3; i += 1) await email.queue(harness.sql, newEmail());
    await email.drain({});
    const overview = await email.outboxOverview(userActor(adminId), { limit: 5 });
    expect(overview.counts).toEqual({ pending: 0, sending: 0, sent: 1, failed: 2 });
    expect(overview.failures).toMatchObject({
      count: 2,
      topReason: 'Mailbox does not exist (server said: 550 no such user)',
    });
    expect(overview.recentFailures).toHaveLength(2);
    await expect(
      email.outboxOverview(userActor('0199c3a2-0000-7000-8000-000000000999'), { limit: 5 }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('sends a test email now and reports the outcome instead of throwing', async () => {
    script.push('permanent');
    const failed = await email.sendTest(userActor(adminId), {});
    expect(failed).toMatchObject({
      sent: false,
      to: 'rohan@acme.test',
      failure: {
        stage: 'send',
        message: 'Mailbox does not exist',
        serverResponse: '550 no such user',
      },
    });
    const ok = await email.sendTest(userActor(adminId), { to: 'ops@acme.test' });
    expect(ok).toMatchObject({ sent: true, to: 'ops@acme.test', failure: null });
    expect(sent.at(-1)?.subject).toBe('Test email from Acme Labs');
  });

  it('serves the dev mailbox only while the provider is log', async () => {
    harness.settings.put('email.provider', 'smtp');
    await expect(harness.wired.email.readMailbox(userActor(adminId))).rejects.toBeInstanceOf(
      NotFoundError,
    );
    harness.settings.put('email.provider', 'log');
    await harness.wired.email.sendTest(userActor(adminId), {});
    const mailbox = await harness.wired.email.readMailbox(userActor(adminId));
    expect(mailbox.items[0]).toMatchObject({ subject: 'Test email from Acme Labs' });
    expect(mailbox.items[0]?.html).toContain('Email delivery works');
  });

  it('round-trips its changesets', async () => {
    const runner = await kernelChangelogRunner(harness.sql);
    const reverted = await runner.rollback('core', { toId: '0108-identity-seed' });
    expect(reverted.map((entry) => entry.id).sort()).toEqual(EMAIL_CHANGESET_IDS);
    const [gone] = await harness.sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.tables
       where table_name in ('email_outbox', 'notifications', 'notification_preferences',
                            'notification_schedules')`;
    expect(gone?.n).toBe(0);
    const applied = await runner.update({ contexts: ['test'] });
    expect(applied.map((entry) => entry.id)).toEqual(EMAIL_CHANGESET_IDS);
  });
});
