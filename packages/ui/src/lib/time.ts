import { dateFormat, getFormatLocale, relativeFormat } from './intl.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * "now", "5m ago", "3h ago", "yesterday", "Friday", "12 days ago", "Oct 2", as in the mocks,
 * in the active locale through Intl ("il y a 5 min", "vor 3 Std."). Minutes and hours use the
 * narrow style, days the long one, as the mocks spell them.
 */
export function formatRelative(
  iso: string | null,
  now: Date = new Date(),
  locale: string = getFormatLocale(),
): string {
  if (!iso) return 'Never';
  const then = new Date(iso);
  const diff = now.getTime() - then.getTime();
  const narrow = relativeFormat({ style: 'narrow', numeric: 'auto' }, locale);
  if (diff < MINUTE) return narrow.format(0, 'second');
  if (diff < HOUR) return narrow.format(-Math.floor(diff / MINUTE), 'minute');
  const days = Math.round((startOfDay(now) - startOfDay(then)) / DAY);
  if (days === 0) return narrow.format(-Math.floor(diff / HOUR), 'hour');
  if (days === 1) return relativeFormat({ numeric: 'auto' }, locale).format(-1, 'day');
  if (days < 7) return dateFormat({ weekday: 'long' }, locale).format(then);
  if (days < 60) return relativeFormat({ numeric: 'always' }, locale).format(-days, 'day');
  return dateFormat({ month: 'short', day: 'numeric' }, locale).format(then);
}

/** "Oct 7, 2026, 14:32": the absolute date and time a relative time stands for. */
export function formatAbsolute(iso: string, locale: string = getFormatLocale()): string {
  return dateFormat(
    { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' },
    locale,
  ).format(new Date(iso));
}
