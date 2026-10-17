import { ValidationError } from '@bemmoly/shared';

/*
 * Deploy windows as policies write them: "Mon-Thu 10:00-16:00 Asia/Kolkata", or
 * "Mon,Wed,Fri 09:00-17:00 UTC". Days and times are in the window's own time zone, so a
 * window means the same thing to a person in Bengaluru and the server in UTC.
 */

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export interface DeployWindow {
  days: ReadonlySet<number>;
  /** Minutes after local midnight. */
  start: number;
  end: number;
  timeZone: string;
  text: string;
}

function dayIndex(word: string, text: string): number {
  const index = DAYS.indexOf(word.slice(0, 3).toLowerCase() as (typeof DAYS)[number]);
  if (index < 0) throw new ValidationError(`"${word}" is not a day in the window "${text}"`);
  return index;
}

function minutes(value: string, text: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const hours = Number(match?.[1]);
  const mins = Number(match?.[2]);
  if (!match || hours > 24 || mins > 59) {
    throw new ValidationError(`"${value}" is not a time in the window "${text}"`);
  }
  return hours * 60 + mins;
}

export function parseWindow(text: string): DeployWindow {
  const [dayPart, timePart, timeZone = 'UTC', ...rest] = text.trim().split(/\s+/);
  if (!dayPart || !timePart || rest.length > 0) {
    throw new ValidationError(
      `Write windows like "Mon-Thu 10:00-16:00 Asia/Kolkata", not "${text}"`,
    );
  }
  const days = new Set<number>();
  for (const piece of dayPart.split(',')) {
    const [from, to] = piece.split('-');
    if (!from) continue;
    const first = dayIndex(from, text);
    const last = to ? dayIndex(to, text) : first;
    for (let day = first; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === last) break;
    }
  }
  const [startText = '', endText = ''] = timePart.split('-');
  const start = minutes(startText, text);
  const end = minutes(endText, text);
  if (end <= start) throw new ValidationError(`The window "${text}" ends before it starts`);
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch {
    throw new ValidationError(`"${timeZone}" is not a time zone`);
  }
  return { days, start, end, timeZone, text };
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function localParts(at: Date, timeZone: string): { day: number; minute: number } {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return {
    day: DAYS.indexOf(get('weekday').toLowerCase() as (typeof DAYS)[number]),
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

export function isOpen(window: DeployWindow, at: Date): boolean {
  const { day, minute } = localParts(at, window.timeZone);
  return window.days.has(day) && minute >= window.start && minute < window.end;
}

const MINUTE = 60_000;

/** The next minute the window opens, within eight days; null if it never does. */
export function nextOpening(window: DeployWindow, at: Date): Date | null {
  let cursor = Math.ceil(at.getTime() / MINUTE) * MINUTE;
  const limit = cursor + 8 * 24 * 60 * MINUTE;
  while (cursor < limit) {
    if (isOpen(window, new Date(cursor))) return new Date(cursor);
    const { minute } = localParts(new Date(cursor), window.timeZone);
    // Outside the hours, jump to the next quarter hour boundary; windows start on minutes.
    cursor += minute < window.start - 15 || minute >= window.end ? 15 * MINUTE : MINUTE;
  }
  return null;
}

/** When an open window closes, for "open until 16:00". */
export function closesAt(window: DeployWindow, at: Date): Date {
  const { minute } = localParts(at, window.timeZone);
  return new Date(Math.floor(at.getTime() / MINUTE) * MINUTE + (window.end - minute) * MINUTE);
}
