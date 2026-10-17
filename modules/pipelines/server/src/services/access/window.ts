/*
 * Deploy windows as policies write them: "Mon-Thu 10:00-16:00 Asia/Kolkata". Days are a
 * range or a comma list, times are 24-hour local times in the named time zone, and the end
 * is exclusive. A window that ends before it starts runs past midnight ("22:00-02:00").
 */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface DeployWindow {
  days: ReadonlySet<number>;
  startMinute: number;
  endMinute: number;
  timeZone: string;
  source: string;
}

export type WindowParse = { ok: true; window: DeployWindow } | { ok: false; error: string };

function dayIndex(name: string): number {
  return DAYS.findIndex((day) => day.toLowerCase() === name.slice(0, 3).toLowerCase());
}

function parseDays(text: string): Set<number> | null {
  const days = new Set<number>();
  for (const part of text.split(',')) {
    const [from, to] = part.split('-');
    const start = dayIndex(from ?? '');
    if (start < 0) return null;
    if (to === undefined) {
      days.add(start);
      continue;
    }
    const end = dayIndex(to);
    if (end < 0) return null;
    for (let day = start; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === end) break;
    }
  }
  return days;
}

function parseMinute(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

function validTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function parseWindow(source: string): WindowParse {
  const [dayText, timeText, zone = 'UTC', ...rest] = source.trim().split(/\s+/);
  const error = (message: string): WindowParse => ({ ok: false, error: message });
  if (!dayText || !timeText || rest.length > 0) {
    return error('Write windows like "Mon-Thu 10:00-16:00 Asia/Kolkata"');
  }
  const days = parseDays(dayText);
  if (!days) return error(`"${dayText}" is not a day or a range of days like Mon-Thu`);
  const [startText = '', endText = ''] = timeText.split('-');
  const startMinute = parseMinute(startText);
  const endMinute = parseMinute(endText);
  if (startMinute === null || endMinute === null || startMinute === endMinute) {
    return error(`"${timeText}" is not a time range like 10:00-16:00`);
  }
  if (!validTimeZone(zone)) return error(`"${zone}" is not a time zone like Asia/Kolkata`);
  return { ok: true, window: { days, startMinute, endMinute, timeZone: zone, source } };
}

/** The weekday and minute of the day at `at`, in the window's time zone. */
function localTime(at: Date, timeZone: string): { day: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: dayIndex(part('weekday')),
    minute: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

export function insideWindow(window: DeployWindow, at: Date): boolean {
  const { day, minute } = localTime(at, window.timeZone);
  if (window.startMinute < window.endMinute) {
    return window.days.has(day) && minute >= window.startMinute && minute < window.endMinute;
  }
  // Past midnight: the late part belongs to the day it started, the early part to the next.
  if (minute >= window.startMinute) return window.days.has(day);
  return minute < window.endMinute && window.days.has((day + 6) % 7);
}

const clock = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** "Mon to Thu, 10:00 to 16:00 (Asia/Kolkata)", for sentences. */
export function describeWindow(window: DeployWindow): string {
  const sorted = [...window.days].sort((a, b) => a - b);
  const contiguous = sorted.every(
    (day, index) => index === 0 || day === (sorted[index - 1] ?? 0) + 1,
  );
  const names = sorted.map((day) => DAYS[day] ?? '');
  const days =
    sorted.length === 7
      ? 'Every day'
      : sorted.length === 1
        ? (FULL_DAYS[sorted[0] ?? 0] ?? '')
        : contiguous
          ? `${names[0]} to ${names.at(-1)}`
          : names.join(', ');
  return `${days}, ${clock(window.startMinute)} to ${clock(window.endMinute)} (${window.timeZone})`;
}
