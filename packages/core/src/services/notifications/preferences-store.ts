import { defaultChannelFor, type DigestSchedule, type NotificationChannel } from '@bemmoly/shared';
import type { SqlExecutor } from '../../contracts/sql.ts';

export const DEFAULT_SCHEDULE: DigestSchedule = {
  cadence: 'interval',
  dailyHour: 8,
  timeZone: 'UTC',
};

/** Stored channel per kind; kinds without a row use the kind's default. */
export async function readChannels(
  db: SqlExecutor,
  userId: string,
): Promise<Map<string, NotificationChannel>> {
  const rows = await db<{ kind: string; channel: NotificationChannel }[]>`
    select kind, channel from notification_preferences where user_id = ${userId}`;
  return new Map(rows.map((row) => [row.kind, row.channel]));
}

/** Effective channel of one kind for many users at once. */
export async function channelsForKind(
  db: SqlExecutor,
  userIds: readonly string[],
  kind: string,
): Promise<Map<string, NotificationChannel>> {
  const rows = await db<{ user_id: string; channel: NotificationChannel }[]>`
    select user_id, channel from notification_preferences
     where kind = ${kind} and user_id = any(${db.array([...userIds])}::uuid[])`;
  const stored = new Map(rows.map((row) => [row.user_id, row.channel]));
  return new Map(userIds.map((id) => [id, stored.get(id) ?? defaultChannelFor(kind)]));
}

export async function upsertChannels(
  db: SqlExecutor,
  userId: string,
  channels: ReadonlyArray<[string, NotificationChannel]>,
): Promise<void> {
  for (const [kind, channel] of channels) {
    await db`
      insert into notification_preferences (user_id, kind, channel)
      values (${userId}, ${kind}, ${channel})
      on conflict (user_id, kind)
      do update set channel = excluded.channel, updated_at = now()`;
  }
}

export async function readSchedules(
  db: SqlExecutor,
  userIds: readonly string[],
): Promise<Map<string, DigestSchedule>> {
  const rows = await db<
    { user_id: string; cadence: DigestSchedule['cadence']; daily_hour: number; time_zone: string }[]
  >`
    select user_id, cadence, daily_hour, time_zone from notification_schedules
     where user_id = any(${db.array([...userIds])}::uuid[])`;
  const stored = new Map(
    rows.map((row) => [
      row.user_id,
      { cadence: row.cadence, dailyHour: row.daily_hour, timeZone: row.time_zone },
    ]),
  );
  return new Map(userIds.map((id) => [id, stored.get(id) ?? DEFAULT_SCHEDULE]));
}

export async function upsertSchedule(
  db: SqlExecutor,
  userId: string,
  schedule: DigestSchedule,
): Promise<void> {
  await db`
    insert into notification_schedules (user_id, cadence, daily_hour, time_zone)
    values (${userId}, ${schedule.cadence}, ${schedule.dailyHour}, ${schedule.timeZone})
    on conflict (user_id)
    do update set cadence = excluded.cadence, daily_hour = excluded.daily_hour,
                  time_zone = excluded.time_zone, updated_at = now()`;
}
