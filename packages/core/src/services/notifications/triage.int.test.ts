import type { NotificationPatchResponse } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import type { DirectoryUser } from '../../contracts/users.ts';
import { useNotificationsFixture } from '../../testing/notifications-fixture.ts';

describe('inbox triage (done, snooze, undo) against Postgres', () => {
  const f = useNotificationsFixture();

  const patch = (id: string, payload: unknown, user: DirectoryUser = f.rohan) =>
    f.h.app.inject({
      method: 'PATCH',
      url: `/api/v1/notifications/${id}`,
      headers: f.as(user),
      payload: payload as Record<string, unknown>,
    });

  /** Three comments on PLT-204 (one grouped entry) and one assignment on PLT-9. */
  async function seed() {
    for (const actor of [f.aisha, f.jonas, f.aisha]) {
      await f.request({ actorId: actor.id, actorName: actor.name });
    }
    await f.request({ kind: 'assignment', target: { kind: 'issue', id: 'i-9', label: 'PLT-9' } });
    const inbox = await f.inbox(f.rohan);
    const comments = inbox.items.find((item) => item.kind === 'comment');
    const assignment = inbox.items.find((item) => item.kind === 'assignment');
    if (!comments || !assignment) throw new Error('seeded entries missing');
    return { comments, assignment };
  }

  it('moves a grouped entry to done, marks it read, and undo brings it back unread', async () => {
    const { comments } = await seed();
    const done = await patch(comments.id, { done: true });
    expect(done.json<NotificationPatchResponse>()).toMatchObject({ read: true, done: true });
    expect(done.json<NotificationPatchResponse>().ids).toHaveLength(3);
    expect(f.h.realtime.messages.at(-1)).toMatchObject({
      kind: 'notifications',
      userId: f.rohan.id,
    });

    const inbox = await f.inbox(f.rohan);
    expect(inbox.items.map((item) => item.kind)).toEqual(['assignment']);
    expect(inbox.unreadCount).toBe(1);
    const archived = await f.inbox(f.rohan, '?view=done');
    expect(archived.items).toHaveLength(1);
    expect(archived.items[0]).toMatchObject({ kind: 'comment', done: true, read: true });
    expect(archived.items[0]?.ids).toHaveLength(3);
    expect(archived.unreadCount).toBe(1);

    const undone = await patch(comments.id, { done: false });
    expect(undone.json<NotificationPatchResponse>()).toEqual({
      ids: expect.any(Array) as unknown,
      done: false,
    });
    const back = await f.inbox(f.rohan);
    expect(back.unreadCount).toBe(4);
    expect(back.items.find((item) => item.kind === 'comment')).toMatchObject({
      done: false,
      read: false,
    });
    expect((await f.inbox(f.rohan, '?view=done')).items).toHaveLength(0);
  });

  it('keeps an entry read earlier read when its done is undone', async () => {
    const { assignment } = await seed();
    await patch(assignment.id, { read: true });
    await patch(assignment.id, { done: true });
    await patch(assignment.id, { done: false });
    const back = await f.inbox(f.rohan);
    expect(back.items.find((item) => item.kind === 'assignment')?.read).toBe(true);
    expect(back.unreadCount).toBe(3);
  });

  it('hides a snoozed entry until its time passes, then returns it unread', async () => {
    const { comments, assignment } = await seed();
    await patch(assignment.id, { read: true });
    const until = new Date(Date.now() + 60 * 60_000).toISOString();
    const snoozed = await patch(assignment.id, { snoozedUntil: until });
    expect(snoozed.json<NotificationPatchResponse>()).toMatchObject({
      read: false,
      snoozedUntil: until,
    });

    const inbox = await f.inbox(f.rohan);
    expect(inbox.items.map((item) => item.id)).toEqual([comments.id]);
    expect(inbox.unreadCount).toBe(3);
    const later = await f.inbox(f.rohan, '?view=snoozed');
    expect(later.items).toEqual([
      expect.objectContaining({ id: assignment.id, read: false, snoozedUntil: until }),
    ]);

    // Read-all clears the inbox only, so the snoozed entry still returns unread.
    await f.h.app.inject({
      method: 'POST',
      url: '/api/v1/notifications/read-all',
      headers: f.as(f.rohan),
    });
    await f.h.sql`
      update notifications set snoozed_until = now() - interval '1 minute'
       where id = ${assignment.id}`;
    const returned = await f.inbox(f.rohan);
    expect(returned.items.map((item) => item.id)).toContain(assignment.id);
    expect(returned.items.find((item) => item.id === assignment.id)?.read).toBe(false);
    expect(returned.unreadCount).toBe(1);
    expect((await f.inbox(f.rohan, '?view=snoozed')).items).toHaveLength(0);
  });

  it('ends a snooze early with null, and done wins over a snooze', async () => {
    const { comments, assignment } = await seed();
    const until = new Date(Date.now() + 60 * 60_000).toISOString();
    await patch(assignment.id, { snoozedUntil: until });
    const woken = await patch(assignment.id, { snoozedUntil: null });
    expect(woken.json<NotificationPatchResponse>()).toMatchObject({ snoozedUntil: null });
    expect((await f.inbox(f.rohan)).items.map((item) => item.id)).toContain(assignment.id);

    await patch(comments.id, { snoozedUntil: until });
    await patch(comments.id, { done: true });
    expect((await f.inbox(f.rohan, '?view=snoozed')).items).toHaveLength(0);
    expect((await f.inbox(f.rohan, '?view=done')).items.map((item) => item.id)).toEqual([
      comments.id,
    ]);
  });

  it('rejects an empty or unknown change, another person’s entry, and a bad view', async () => {
    const { comments } = await seed();
    expect((await patch(comments.id, {})).statusCode).toBe(400);
    expect((await patch(comments.id, { archived: true })).statusCode).toBe(400);
    expect((await patch(comments.id, { snoozedUntil: 'tomorrow' })).statusCode).toBe(400);
    expect((await patch(comments.id, { done: true }, f.jonas)).statusCode).toBe(404);
    const badView = await f.h.app.inject({
      url: '/api/v1/notifications?view=later',
      headers: f.as(f.rohan),
    });
    expect(badView.statusCode).toBe(400);
    expect((await f.inbox(f.rohan)).unreadCount).toBe(4);
  });
});
