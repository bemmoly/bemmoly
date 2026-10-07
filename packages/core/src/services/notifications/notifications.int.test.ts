import { NOTIFICATION_EVENT_KINDS } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { DirectoryUser } from '../../contracts/users.ts';
import { useNotificationsFixture } from '../../testing/notifications-fixture.ts';
import { EMAIL_SEND_JOB } from '../email/index.ts';
import { DIGEST_JOB } from './index.ts';

describe('notification dispatch against Postgres', () => {
  const f = useNotificationsFixture();

  it('writes one row per recipient, never the actor, and pushes it to their sockets', async () => {
    await f.request({ recipientIds: [f.rohan.id, f.jonas.id, f.aisha.id] });
    const rows = await f.h.sql<{ user_id: string }[]>`select user_id from notifications`;
    expect(rows.map((row) => row.user_id).sort()).toEqual([f.jonas.id, f.rohan.id].sort());
    expect(f.h.realtime.messages.map((message) => message.userId).sort()).toEqual(
      [f.jonas.id, f.rohan.id].sort(),
    );
    expect(f.h.realtime.messages[0]).toMatchObject({ kind: 'notifications' });
  });

  it('emails a mention at once, with the reason line and List-Unsubscribe headers', async () => {
    await f.request({ kind: 'mention', body: '@Rohan can you confirm?' });
    const [mail] = await f.outbox();
    expect(mail).toMatchObject({
      kind: 'notification.mention',
      to_address: 'rohan@acme.test',
      subject: 'Aisha K. mentioned you in PLT-204',
    });
    expect(mail?.text).toContain("You're receiving this because you were mentioned in PLT-204.");
    expect(mail?.headers['List-Unsubscribe']).toMatch(
      /^<https:\/\/bemmoly\.example\.com\/api\/v1\/email-unsubscriptions\?token=/,
    );
    expect(mail?.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(f.h.jobs.queued.map((job) => job.name)).toEqual([EMAIL_SEND_JOB]);
  });

  it('follows each recipient’s preference: in-app only, or nothing at all', async () => {
    const put = (user: DirectoryUser, kinds: Record<string, string>) =>
      f.h.app.inject({
        method: 'PUT',
        url: '/api/v1/notification-preferences',
        headers: f.as(user),
        payload: { kinds },
      });
    expect((await put(f.rohan, { mention: 'inapp' })).statusCode).toBe(200);
    expect((await put(f.jonas, { mention: 'off' })).statusCode).toBe(200);
    await f.request({ kind: 'mention', recipientIds: [f.rohan.id, f.jonas.id] });
    expect((await f.inbox(f.rohan)).items).toHaveLength(1);
    expect((await f.inbox(f.jonas)).items).toHaveLength(0);
    expect(await f.outbox()).toHaveLength(0);
  });

  it('batches digest kinds into one email per user', async () => {
    await f.request({ actorId: f.aisha.id, actorName: 'Aisha K.' });
    await f.request({ actorId: f.jonas.id, actorName: 'Jonas M.' });
    await f.request({
      kind: 'status_change',
      target: { kind: 'issue', id: 'i-226', label: 'PLT-226' },
      body: 'In progress → In review',
    });
    expect(f.h.jobs.queued.filter((job) => job.name === DIGEST_JOB)).toHaveLength(1);
    expect(await f.outbox()).toHaveLength(0);

    await f.h.jobs.runAll(DIGEST_JOB);
    const [digest] = await f.outbox();
    expect(digest).toMatchObject({
      kind: 'notification.digest',
      subject: '2 new updates in Acme Labs',
    });
    expect(digest?.text).toContain('Jonas M. and Aisha K. commented on PLT-204');
    expect(digest?.text).toContain('Aisha K. moved PLT-226');
    const pending = await f.h.sql`select id from notifications where emailed_at is null`;
    expect(pending).toHaveLength(0);
    await f.h.jobs.runAll(DIGEST_JOB);
    expect(await f.outbox()).toHaveLength(1);
  });

  it('leaves rows read in the app out of the digest', async () => {
    await f.request();
    await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: f.as(f.rohan),
    });
    await f.h.wired.notifications.sendDigest(f.rohan.id);
    expect(await f.outbox()).toHaveLength(0);
  });

  it('rolls back with the publisher’s transaction and ignores a repeated dedupe key', async () => {
    await f.h.sql
      .begin(async (tx) => {
        await f.h.events.publish({
          kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
          occurredAt: new Date(),
          transaction: tx,
          payload: {
            kind: 'mention',
            recipientIds: [f.rohan.id],
            target: { kind: 'issue', id: 'i-1', label: 'PLT-1' },
          },
        });
        throw new Error('the comment failed to save');
      })
      .catch(() => undefined);
    expect(await f.h.sql`select id from notifications`).toHaveLength(0);
    expect(await f.outbox()).toHaveLength(0);

    await f.request({ dedupeKey: 'comment:c1' });
    await f.request({ dedupeKey: 'comment:c1' });
    expect(await f.h.sql`select id from notifications`).toHaveLength(1);
  });
});
