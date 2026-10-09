/*
 * Sprint dates as the dialogs edit them: whole days in date inputs, sent as
 * the start of the first day and the end of the last, in UTC so the header's
 * "Sep 23 – Oct 7" reads the same days back.
 */

const DAY_MS = 86_400_000;

/** "2026-10-07" from an ISO timestamp, or from today when there is none. */
export function dayOf(iso: string | null, fallback: Date = new Date()): string {
  return (iso ? new Date(iso) : fallback).toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export const startOf = (day: string) => `${day}T00:00:00.000Z`;
export const endOf = (day: string) => `${day}T23:59:59.000Z`;

/** The planned dates, or today plus the board's cadence for a sprint without them. */
export function plannedDays(
  sprint: { startsAt: string | null; endsAt: string | null },
  cadenceDays: number,
  today: Date = new Date(),
): { start: string; end: string } {
  const start = dayOf(sprint.startsAt, today);
  const end = sprint.endsAt ? dayOf(sprint.endsAt) : addDays(start, Math.max(1, cadenceDays) - 1);
  return { start, end };
}

/** Says what is wrong with a pair of days, or nothing when they make a sprint. */
export function datesProblem(start: string, end: string): string | null {
  if (!start || !end) return 'Choose both dates.';
  return end < start ? 'The sprint has to end on or after the day it starts.' : null;
}
