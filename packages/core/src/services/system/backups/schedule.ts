import type { BackupScheduleSettings } from '@bemmoly/shared';
import { addDays, localParts, zonedTimeToUtc } from '../utils/zoned-time.ts';

/** The pg-boss cron for the system.backup tick; the tick decides whether a slot is due. */
export const BACKUP_TICK_CRON = '*/5 * * * *';

function parseTime(time: string): { hour: number; minute: number } {
  const [hour = '2', minute = '0'] = time.split(':');
  return { hour: Number(hour), minute: Number(minute) };
}

/**
 * The most recent schedule slot at or before `now`, as an instant. Slots are wall-clock
 * times in the workspace timezone: hourly at :MM, every 6 hours from HH:MM, daily at
 * HH:MM, weekly on `weekday` at HH:MM.
 */
export function latestSlot(schedule: BackupScheduleSettings, now: Date): Date {
  const local = localParts(now, schedule.timezone);
  const { hour, minute } = parseTime(schedule.time);
  const at = (day: { year: number; month: number; day: number }, h: number) =>
    zonedTimeToUtc({ ...day, hour: h, minute }, schedule.timezone);

  switch (schedule.frequency) {
    case 'hourly': {
      const slot = at(local, local.hour);
      return slot <= now ? slot : new Date(slot.getTime() - 60 * 60 * 1_000);
    }
    case '6h': {
      const hours = [0, 6, 12, 18].map((offset) => (hour + offset) % 24).sort((a, b) => b - a);
      for (const candidateHour of hours) {
        const slot = at(local, candidateHour);
        if (slot <= now) return slot;
      }
      return at(addDays(local, -1), hours[0] ?? hour);
    }
    case 'daily': {
      const today = at(local, hour);
      return today <= now ? today : at(addDays(local, -1), hour);
    }
    case 'weekly': {
      const back = (local.weekday - schedule.weekday + 7) % 7;
      const slot = at(addDays(local, -back), hour);
      return slot <= now ? slot : at(addDays(local, -back - 7), hour);
    }
  }
}

/**
 * The slot a scheduled backup should cover now, or null when the latest slot is
 * already covered. A missed slot (the app was down) is caught up once, not per slot.
 */
export function dueSlot(
  schedule: BackupScheduleSettings,
  lastScheduledFor: Date | null,
  now: Date,
): Date | null {
  const slot = latestSlot(schedule, now);
  if (lastScheduledFor && lastScheduledFor.getTime() >= slot.getTime()) return null;
  return slot;
}

/** "nightly", "every 6 hours"… as the Setup mock and the System page print it. */
export function describeFrequency(schedule: BackupScheduleSettings): string {
  switch (schedule.frequency) {
    case 'hourly':
      return 'hourly';
    case '6h':
      return 'every 6 hours';
    case 'daily':
      return 'nightly';
    case 'weekly':
      return 'weekly';
  }
}
