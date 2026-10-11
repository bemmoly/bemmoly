import { defaultChannelFor } from '@bemmoly/shared';
import { describe, expect, it } from 'vitest';
import { fakeJobQueue } from '../../testing/fakes.ts';
import { actorPhrase, reasonFor } from './copy.ts';
import { groupNotifications, type StoredNotification } from './grouping.ts';
import { nextDailyRun, nextDigestAt } from './schedule.ts';

let sequence = 0;
function row(overrides: Partial<StoredNotification>): StoredNotification {
  sequence += 1;
  return {
    id: `0199c3a2-0000-7000-8000-${String(1000 - sequence).padStart(12, '0')}`,
    userId: 'u1',
    kind: 'comment',
    actorId: 'a1',
    actorName: 'Aisha K.',
    targetKind: 'issue',
    targetId: 'i1',
    targetLabel: 'PLT-204',
    targetUrl: '/issues/PLT-204',
    body: '',
    reason: null,
    readAt: null,
    doneAt: null,
    snoozedUntil: null,
    createdAt: new Date('2026-10-07T09:00:00Z'),
    ...overrides,
  };
}

describe('read-time grouping', () => {
  it('folds comments on one target into "Aisha K. and 2 others"', () => {
    const items = groupNotifications([
      row({ actorId: 'a1', actorName: 'Aisha K.', body: 'newest' }),
      row({ actorId: 'a2', actorName: 'Jonas M.' }),
      row({ actorId: 'a1', actorName: 'Aisha K.' }),
      row({ actorId: 'a3', actorName: 'Priya N.' }),
      row({
        kind: 'mention',
        actorId: 'a2',
        actorName: 'Jonas M.',
        targetLabel: 'PLT-218',
        targetId: 'i2',
      }),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      summary: 'Aisha K. and 2 others commented on PLT-204',
      actorCount: 3,
      body: 'newest',
      read: false,
    });
    expect(items[0]?.ids).toHaveLength(4);
    expect(items[1]?.summary).toBe('Jonas M. mentioned you in PLT-218');
  });

  it('keeps read and unread rows apart and names a system actor', () => {
    const items = groupNotifications([
      row({ readAt: new Date() }),
      row({}),
      row({ kind: 'backup_failed', actorId: null, actorName: null, targetLabel: 'Nightly backup' }),
    ]);
    expect(items.map((item) => item.read)).toEqual([true, false, false]);
    expect(items[2]?.summary).toBe('Bemmoly reported a failed backup: Nightly backup');
  });

  it('reports done and snooze, and keeps rows snoozed to different times apart', () => {
    const until = new Date('2026-10-08T09:00:00Z');
    const items = groupNotifications([
      row({ doneAt: new Date(), readAt: new Date() }),
      row({ readAt: new Date() }),
      row({ snoozedUntil: until }),
      row({ snoozedUntil: until }),
      row({ snoozedUntil: new Date('2026-10-09T09:00:00Z') }),
    ]);
    expect(items.map((item) => [item.done, item.snoozedUntil, item.ids.length])).toEqual([
      [true, null, 1],
      [false, null, 1],
      [false, '2026-10-08T09:00:00.000Z', 2],
      [false, '2026-10-09T09:00:00.000Z', 1],
    ]);
  });

  it('phrases two actors with "and"', () => {
    expect(actorPhrase(['Aisha K.', 'Jonas M.'])).toBe('Aisha K. and Jonas M.');
  });
});

describe('preference routing defaults', () => {
  it('sends mentions, assignments and review requests at once and batches the rest', () => {
    expect(['mention', 'assignment', 'review_request'].map(defaultChannelFor)).toEqual([
      'email_immediate',
      'email_immediate',
      'email_immediate',
    ]);
    expect(['comment', 'status_change', 'work.sprint_started'].map(defaultChannelFor)).toEqual([
      'email_digest',
      'email_digest',
      'email_digest',
    ]);
  });

  it('states a reason per kind, or the publisher’s own', () => {
    expect(reasonFor('comment', 'PLT-204')).toBe(
      "You're receiving this because you watch PLT-204.",
    );
    expect(reasonFor('mention', 'PLT-218')).toBe(
      "You're receiving this because you were mentioned in PLT-218.",
    );
    expect(reasonFor('comment', 'PLT-204', 'you are on the review rota.')).toBe(
      "You're receiving this because you are on the review rota.",
    );
  });
});

describe('digest scheduling', () => {
  const now = new Date('2026-10-07T12:34:00Z');

  it('batches every interval by default', () => {
    expect(nextDigestAt(now, { cadence: 'interval', dailyHour: 8, timeZone: 'UTC' }, 10)).toEqual(
      new Date('2026-10-07T12:44:00Z'),
    );
  });

  it('finds the next local hour for a daily summary', () => {
    expect(nextDailyRun(now, 8, 'UTC')).toEqual(new Date('2026-10-08T08:00:00Z'));
    // 12:34 UTC is 18:04 in Kolkata, so 18:00 there has passed today.
    expect(nextDailyRun(now, 18, 'Asia/Kolkata')).toEqual(new Date('2026-10-08T12:30:00Z'));
    expect(nextDailyRun(now, 19, 'Asia/Kolkata')).toEqual(new Date('2026-10-07T13:30:00Z'));
    // 08:34 in New York (EDT); 09:00 is still ahead today.
    expect(nextDailyRun(now, 9, 'America/New_York')).toEqual(new Date('2026-10-07T13:00:00Z'));
  });

  it('collapses many digest requests for one user into one waiting job', async () => {
    const jobs = fakeJobQueue();
    for (let i = 0; i < 5; i += 1) {
      await jobs.enqueue(
        'notifications.digest',
        { userId: 'u1' },
        { key: 'digest:u1', singleton: true },
      );
    }
    await jobs.enqueue(
      'notifications.digest',
      { userId: 'u2' },
      { key: 'digest:u2', singleton: true },
    );
    expect(jobs.queued.map((job) => job.options.key)).toEqual(['digest:u1', 'digest:u2']);
  });
});
