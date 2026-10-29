/*
 * Counting leave the same way in the browser and on the server, so the number a person sees
 * before sending is the number their balance moves by. Weekends are not counted; location
 * holiday calendars are a later step.
 */

const DAY = 86_400_000;

const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);

export const isoDate = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Every calendar date from `start` to `end`, both included. */
export function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let time = toUtc(start); time <= toUtc(end); time += DAY) out.push(isoDate(time));
  return out;
}

export const isWeekend = (date: string) => {
  const day = new Date(toUtc(date)).getUTCDay();
  return day === 0 || day === 6;
};

/** Working days in the range; a half day takes half off the first day. */
export function leaveDays(start: string, end: string, halfDay = false): number {
  if (end < start) return 0;
  const days = datesBetween(start, end).filter((date) => !isWeekend(date)).length;
  return halfDay && days > 0 ? days - 0.5 : days;
}

/** Whether two inclusive date ranges share a day. */
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  a.start <= b.end && b.start <= a.end;

export const addDays = (date: string, days: number) => isoDate(toUtc(date) + days * DAY);
