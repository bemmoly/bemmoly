import { z } from 'zod';

/*
 * The quarter view: how a project's sprints, epics and completed work went over one calendar
 * quarter (UTC), for teams that plan by the quarter. Rebuilt on read; nothing is stored.
 */

/** "2026-Q4". */
export const quarterRefSchema = z.string().regex(/^\d{4}-Q[1-4]$/, 'Name a quarter as 2026-Q4');

export const quarterReportQuerySchema = z.object({
  /** The current quarter when absent. */
  quarter: quarterRefSchema.optional(),
});

export const quarterSprintSchema = z.object({
  sprintId: z.uuid(),
  name: z.string(),
  state: z.enum(['future', 'active', 'closed']),
  from: z.iso.date().nullable(),
  to: z.iso.date().nullable(),
  committedPoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
});

export const quarterEpicSchema = z.object({
  epicId: z.uuid(),
  key: z.string(),
  title: z.string(),
  done: z.boolean(),
  issues: z.number().int().nonnegative(),
  doneIssues: z.number().int().nonnegative(),
  points: z.number().nonnegative(),
  donePoints: z.number().nonnegative(),
  /** Its issues finished inside the quarter. */
  completedInQuarter: z.number().int().nonnegative(),
});

/** The quarter's scope and what was finished in it, at the end of each week. */
export const quarterWeekSchema = z.object({
  date: z.iso.date(),
  scopeIssues: z.number().int().nonnegative(),
  completedIssues: z.number().int().nonnegative(),
  scopePoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
});

export const quarterReportSchema = z.object({
  quarter: quarterRefSchema,
  from: z.iso.date(),
  to: z.iso.date(),
  /** How much of the quarter has passed, 0 to 1. */
  elapsed: z.number().min(0).max(1),
  sprints: z.array(quarterSprintSchema),
  epics: z.array(quarterEpicSchema),
  weeks: z.array(quarterWeekSchema),
});

export type QuarterRef = z.infer<typeof quarterRefSchema>;
export type QuarterReportQuery = z.input<typeof quarterReportQuerySchema>;
export type QuarterSprint = z.infer<typeof quarterSprintSchema>;
export type QuarterEpic = z.infer<typeof quarterEpicSchema>;
export type QuarterWeek = z.infer<typeof quarterWeekSchema>;
export type QuarterReport = z.infer<typeof quarterReportSchema>;

/** The quarter an instant falls in, in UTC. */
export function quarterOf(instant: number): QuarterRef {
  const date = new Date(instant);
  return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
}

/** A quarter's first instant and the first instant after it. */
export function quarterBounds(ref: QuarterRef): { start: number; end: number } {
  const [year, q] = ref.split('-Q').map(Number) as [number, number];
  return { start: Date.UTC(year, (q - 1) * 3, 1), end: Date.UTC(year, q * 3, 1) };
}

/** The quarter `step` quarters after (or before, when negative) this one. */
export function shiftQuarter(ref: QuarterRef, step: number): QuarterRef {
  const [year, q] = ref.split('-Q').map(Number) as [number, number];
  const index = year * 4 + (q - 1) + step;
  return `${Math.floor(index / 4)}-Q${(index % 4) + 1}`;
}
