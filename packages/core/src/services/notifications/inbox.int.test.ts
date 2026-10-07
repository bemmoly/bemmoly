import { NOTIFICATION_EVENT_KINDS } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { useNotificationsFixture } from '../../testing/notifications-fixture.ts';
import { EMAIL_SEND_JOB } from '../email/index.ts';
import { DIGEST_JOB } from './index.ts';

describe('inbox, preferences and unsubscribe links against Postgres', () => {
  const f = useNotificationsFixture();

  it('pages the inbox by keyset, grouped, and marks a group read', async () => {
    for (const actor of [f.aisha, f.jonas, f.aisha]) {
      await f.request({ actorId: actor.id, actorName: actor.name });
    }
    await f.request({ kind: 'assignment', target: { kind: 'issue', id: 'i-9', label: 'PLT-9' } });
    const first = await f.inbox(f.rohan, '?limit=2');
    expect(first.unreadCount).toBe(4);
    expect(first.items.map((item) => item.summary)).toEqual([
      'Aisha K. assigned you PLT-9',
      'Aisha K. commented on PLT-204',
    ]);
    expect(first.nextCursor).not.toBeNull();
    const second = await f.inbox(f.rohan, `?limit=2&cursor=${first.nextCursor}`);
    expect(second.items[0]?.summary).toBe('Jonas M. and Aisha K. commented on PLT-204');
    const all = await f.inbox(f.rohan);
    const comments = all.items.find((item) => item.kind === 'comment');
    expect(comments?.ids).toHaveLength(3);

    const patched = await f.h.app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${comments?.id}`,
      headers: f.as(f.rohan),
      payload: { read: true },
    });
    expect(patched.json<{ ids: string[] }>().ids).toHaveLength(3);
    expect((await f.inbox(f.rohan)).unreadCount).toBe(1);
    const other = await f.h.app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${comments?.id}`,
      headers: f.as(f.jonas),
      payload: { read: true },
    });
    expect(other.statusCode).toBe(404);
    const readAll = await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: f.as(f.rohan),
    });
    expect(readAll.json()).toEqual({ updated: 1 });
    expect((await f.h.app.inject({ url: '/api/v1/notifications' })).statusCode).toBe(401);
  });

  it('unsubscribes from one kind by link, without signing in', async () => {
    await f.request({ kind: 'mention' });
    const [mail] = await f.outbox();
    const oneClick = /<([^>]+)>/.exec(mail?.headers['List-Unsubscribe'] ?? '')?.[1] ?? '';
    const token = new URL(oneClick).searchParams.get('token') ?? '';

    const preview = await f.h.app.inject({
      url: new URL(oneClick).pathname + new URL(oneClick).search,
    });
    expect(preview.json()).toEqual({ scope: 'mention', label: 'Mentions', emailEnabled: true });

    const clicked = await f.h.app.inject({
      method: 'POST',
      url: new URL(oneClick).pathname + new URL(oneClick).search,
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'List-Unsubscribe=One-Click',
    });
    expect(clicked.statusCode).toBe(201);
    expect(clicked.json()).toMatchObject({ scope: 'mention', emailEnabled: false });

    const prefs = await f.h.app.inject({
      url: '/api/v1/notification-preferences',
      headers: f.as(f.rohan),
    });
    expect(prefs.json<{ kinds: { kind: string; channel: string }[] }>().kinds).toContainEqual(
      expect.objectContaining({ kind: 'mention', channel: 'inapp' }),
    );
    const forged = await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/email-unsubscriptions',
      payload: { token: `${token.split('.')[0]}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` },
    });
    expect(forged.statusCode).toBe(400);
  });

  it('turns off every digest kind from the digest’s link', async () => {
    await f.request();
    await f.h.jobs.runAll(DIGEST_JOB);
    const [digest] = await f.outbox();
    const token = /token=([^>&]+)/.exec(digest?.headers['List-Unsubscribe'] ?? '')?.[1] ?? '';
    const response = await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/email-unsubscriptions',
      payload: { token: decodeURIComponent(token) },
    });
    expect(response.json()).toMatchObject({ scope: 'digest', emailEnabled: false });
    const channels = await f.h.sql<{ kind: string; channel: string }[]>`
      select kind, channel from notification_preferences where user_id = ${f.rohan.id}`;
    expect(channels.every((row) => row.channel === 'inapp')).toBe(true);
    expect(channels.map((row) => row.kind)).toContain('comment');
    expect(channels.map((row) => row.kind)).not.toContain('mention');
  });

  it('sends invitation and password reset emails from their events', async () => {
    await f.h.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.invitationCreated,
      occurredAt: new Date(),
      payload: {
        invitationId: 'inv-1',
        email: 'new@acme.test',
        inviterName: 'Rohan',
        acceptUrl: 'https://bemmoly.example.com/invitations/abc',
        expiresAt: '2026-10-14T00:00:00Z',
      },
    });
    await f.h.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.passwordResetRequested,
      occurredAt: new Date(),
      payload: {
        resetId: 'r-1',
        userId: f.rohan.id,
        email: 'rohan@acme.test',
        resetUrl: 'https://bemmoly.example.com/reset/xyz',
        expiresAt: '2026-10-07T12:00:00Z',
      },
    });
    const mails = await f.outbox();
    expect(mails.map((mail) => [mail.kind, mail.subject])).toEqual([
      ['invitation', 'Rohan invited you to Acme Labs'],
      ['password_reset', 'Reset your Acme Labs password'],
    ]);
    expect(mails[0]?.headers['List-Unsubscribe']).toBeUndefined();
  });

  it('produces an inbox row and a dev mailbox entry from the dev endpoint', async () => {
    const created = await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/dev/notifications',
      headers: f.as(f.rohan),
      payload: { kind: 'mention', actorName: 'Priya N.', body: 'Can you confirm the hook?' },
    });
    expect(created.statusCode).toBe(201);
    expect((await f.inbox(f.rohan)).items[0]?.summary).toBe('Priya N. mentioned you in DEV-1');
    await f.h.jobs.runAll(EMAIL_SEND_JOB);
    const mailbox = await f.h.app.inject({ url: '/api/v1/dev/mailbox', headers: f.as(f.rohan) });
    expect(mailbox.json<{ items: { subject: string }[] }>().items[0]?.subject).toBe(
      'Priya N. mentioned you in DEV-1',
    );
    f.h.settings.put('email.provider', 'smtp');
    const closed = await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/dev/notifications',
      headers: f.as(f.rohan),
    });
    expect(closed.statusCode).toBe(404);
    f.h.settings.put('email.provider', 'log');
  });
});
