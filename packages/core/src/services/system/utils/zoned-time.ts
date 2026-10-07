export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, value);
  }
  return value;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The wall-clock fields of `date` in `timeZone`. */
export function localParts(date: Date, timeZone: string): LocalParts {
  const parts: Record<string, string> = {};
  for (const part of formatter(timeZone).formatToParts(date)) parts[part.type] = part.value;
  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    hour: Number(parts['hour']),
    minute: Number(parts['minute']),
    weekday: WEEKDAYS[parts['weekday'] ?? 'Sun'] ?? 0,
  };
}

/** The instant whose wall clock in `timeZone` reads the given fields (first match across a DST fold). */
export function zonedTimeToUtc(
  fields: Pick<LocalParts, 'year' | 'month' | 'day' | 'hour' | 'minute'>,
  timeZone: string,
): Date {
  const wanted = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute);
  let guess = wanted;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const seen = localParts(new Date(guess), timeZone);
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
    const drift = seenUtc - wanted;
    if (drift === 0) break;
    guess -= drift;
  }
  return new Date(guess);
}

/** Shifts calendar fields by whole days, normalising month and year. */
export function addDays<T extends Pick<LocalParts, 'year' | 'month' | 'day'>>(
  fields: T,
  days: number,
): T {
  const shifted = new Date(Date.UTC(fields.year, fields.month - 1, fields.day + days));
  return {
    ...fields,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** ISO-8601 week key, e.g. "2026-W41", of a calendar date. */
export function isoWeekKey(fields: Pick<LocalParts, 'year' | 'month' | 'day'>): string {
  const date = new Date(Date.UTC(fields.year, fields.month - 1, fields.day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
