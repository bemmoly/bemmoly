/**
 * Shared setup for the notifications integration suites: a harness with three
 * people (Rohan is the admin) and helpers to publish, read the inbox and read
 * the outbox. Registers its own hooks; call it inside `describe`. Test-only.
 */
import { NOTIFICATION_EVENT_KINDS, type NotificationListResponse } from '@bemmoly/shared';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import type { DirectoryUser } from '../contracts/users.ts';
import { startHarness, type Harness } from './email-notifications-harness.ts';
import { startTestDatabase, type TestDatabase } from './postgres.ts';

export interface OutboxRow {
  kind: string;
  to_address: string;
  subject: string;
  text: string;
  headers: Record<string, string>;
}

export interface NotificationsFixture {
  h: Harness;
  aisha: DirectoryUser;
  jonas: DirectoryUser;
  rohan: DirectoryUser;
  request(overrides?: Record<string, unknown>): Promise<void>;
  as(user: DirectoryUser): Record<string, string>;
  inbox(user: DirectoryUser, query?: string): Promise<NotificationListResponse>;
  outbox(): Promise<OutboxRow[]>;
}

export function useNotificationsFixture(): NotificationsFixture {
  let database: TestDatabase;
  const fixture = {} as NotificationsFixture;

  beforeAll(async () => {
    database = await startTestDatabase();
    if (!database.available) return;
    const h = await startHarness(database, () => [fixture.rohan.id]);
    fixture.h = h;
    fixture.aisha = await h.addUser('Aisha K.', 'aisha@acme.test');
    fixture.jonas = await h.addUser('Jonas M.', 'jonas@acme.test');
    fixture.rohan = await h.addUser('Rohan', 'rohan@acme.test');
  });

  afterAll(async () => {
    if (!database.available) return;
    await fixture.h.stop();
    await database.stop();
  });

  beforeEach(async (ctx) => {
    if (!database.available) return ctx.skip(database.reason);
    const { h } = fixture;
    await h.sql`truncate notifications, notification_preferences, notification_schedules, email_outbox`;
    h.jobs.queued.length = 0;
    h.realtime.messages.length = 0;
    h.mailbox.clear();
  });

  fixture.request = (overrides = {}) =>
    fixture.h.events.publish({
      kind: NOTIFICATION_EVENT_KINDS.notificationRequested,
      occurredAt: new Date(),
      payload: {
        kind: 'comment',
        recipientIds: [fixture.rohan.id],
        actorId: fixture.aisha.id,
        actorName: 'Aisha K.',
        target: { kind: 'issue', id: 'i-204', label: 'PLT-204', url: '/issues/PLT-204' },
        body: 'Backfill finished on staging.',
        ...overrides,
      },
    });
  fixture.as = (user) => ({ 'x-test-user': user.id });
  fixture.inbox = async (user, query = '') =>
    (
      await fixture.h.app.inject({
        url: `/api/v1/notifications${query}`,
        headers: fixture.as(user),
      })
    ).json<NotificationListResponse>();
  fixture.outbox = () =>
    fixture.h.sql<OutboxRow[]>`
      select kind, to_address, subject, text, headers from email_outbox order by created_at`;
  return fixture;
}
