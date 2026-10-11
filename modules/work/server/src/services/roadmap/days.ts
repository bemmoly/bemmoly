/*
 * Calendar days as whole numbers since 1970-01-01 (UTC), so the forecast adds and compares
 * days without a time zone ever moving one, and turns them back into ISO dates and words.
 */

const DAY_MS = 86_400_000;

/** "2026-10-21" → its day number. */
export const toDay = (iso: string): number => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY_MS);

/** A moment → the day it falls on, in UTC. */
export const dayOf = (moment: Date | number): number =>
  Math.floor((typeof moment === 'number' ? moment : moment.getTime()) / DAY_MS);

/** A day number → "2026-10-21". */
export const fromDay = (day: number): string => new Date(day * DAY_MS).toISOString().slice(0, 10);

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** "Nov 1", with the year only when it is not the year of `today`: "Jan 15, 2027". */
export function dayWords(day: number, today: number): string {
  const date = new Date(day * DAY_MS);
  const words = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return date.getUTCFullYear() === new Date(today * DAY_MS).getUTCFullYear()
    ? words
    : `${words}, ${date.getUTCFullYear()}`;
}

/** "1 day", "11 days". */
export const daysWords = (count: number): string => `${count} ${count === 1 ? 'day' : 'days'}`;
