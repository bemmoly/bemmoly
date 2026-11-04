import type { ChangeEnvironmentRow } from '../../models/change-requests.ts';

/*
 * An environment's deploy window: the days and the hours, in its own time zone, when a
 * deploy may start. No window is any time. A window whose end is before its start runs past
 * midnight (22:00 to 02:00), and counts toward the day it opened.
 */

type Window = NonNullable<ChangeEnvironmentRow['deploy_window']>;

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function localParts(at: Date, timeZone: string): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: part('weekday').slice(0, 3).toLowerCase(),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

const minutesOf = (clock: string) => {
  const [h = '0', m = '0'] = clock.split(':');
  return Number(h) * 60 + Number(m);
};

export function windowOpen(window: Window | null, at: Date): boolean {
  if (!window) return true;
  let local: { day: string; minutes: number };
  try {
    local = localParts(at, window.timeZone);
  } catch {
    // An unknown zone reads as UTC rather than holding every deploy forever.
    local = localParts(at, 'UTC');
  }
  const from = minutesOf(window.from);
  const to = minutesOf(window.to);
  if (from <= to) {
    return window.days.includes(local.day) && local.minutes >= from && local.minutes < to;
  }
  const yesterday = DAYS[(DAYS.indexOf(local.day) + 6) % 7] ?? '';
  return (
    (window.days.includes(local.day) && local.minutes >= from) ||
    (window.days.includes(yesterday) && local.minutes < to)
  );
}

/** "Mon to Fri, 10:00 to 18:00 Asia/Kolkata", for activity lines. */
export function windowText(window: Window | null): string {
  if (!window) return 'any time';
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const days = order.filter((day) => window.days.includes(day));
  const name = (day: string) => day.slice(0, 1).toUpperCase() + day.slice(1);
  const first = days[0];
  const last = days[days.length - 1];
  const contiguous =
    first !== undefined &&
    last !== undefined &&
    order.indexOf(last) - order.indexOf(first) === days.length - 1;
  const span =
    days.length > 2 && contiguous && first && last
      ? `${name(first)} to ${name(last)}`
      : days.map(name).join(', ');
  return `${span}, ${window.from} to ${window.to} ${window.timeZone}`;
}
