import type { DigestSchedule } from '@bemmoly/shared';

const PARTS = ['year', 'month', 'day', 'hour', 'minute', 'second'] as const;

/** Wall-clock parts of `date` in `timeZone`. */
function zonedParts(date: Date, timeZone: string): Record<(typeof PARTS)[number], number> {
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const parts = Object.fromEntries(
    format.formatToParts(date).map((part) => [part.type, Number(part.value)]),
  );
  return Object.fromEntries(PARTS.map((name) => [name, parts[name] ?? 0])) as Record<
    (typeof PARTS)[number],
    number
  >;
}

/** The instant a wall-clock time in `timeZone` happens; DST gaps resolve forward. */
function zonedInstant(
  timeZone: string,
  wall: { year: number; month: number; day: number; hour: number },
): Date {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour);
  const seen = zonedParts(new Date(guess), timeZone);
  const offset =
    Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute, seen.second) - guess;
  return new Date(guess - offset);
}

/** The next time it is `hour` o'clock in `timeZone`, strictly after `now`. */
export function nextDailyRun(now: Date, hour: number, timeZone: string): Date {
  const today = zonedParts(now, timeZone);
  for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
    const day = new Date(Date.UTC(today.year, today.month - 1, today.day + dayOffset));
    const candidate = zonedInstant(timeZone, {
      year: day.getUTCFullYear(),
      month: day.getUTCMonth() + 1,
      day: day.getUTCDate(),
      hour,
    });
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return new Date(now.getTime() + 24 * 3600 * 1000);
}

/** When a user's next digest should go out, given their schedule. */
export function nextDigestAt(now: Date, schedule: DigestSchedule, intervalMinutes: number): Date {
  if (schedule.cadence === 'daily') {
    return nextDailyRun(now, schedule.dailyHour, schedule.timeZone);
  }
  return new Date(now.getTime() + intervalMinutes * 60_000);
}
