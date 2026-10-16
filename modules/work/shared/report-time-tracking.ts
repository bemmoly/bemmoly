import { z } from 'zod';

/*
 * The time tracking report: the minutes logged on a project's issues in a window, by week,
 * by person and by issue. Read from work_logs on demand; nothing is stored. Estimates are
 * story points only (there is no time estimate), so the issue list prints them side by side.
 */

export const timeTrackingQuerySchema = z.object({
  /** How many days back the window reaches, today included. Ignored when a sprint is given. */
  days: z.coerce.number().int().min(7).max(365).default(30),
  /** Only that sprint's issues, from its start to its close (or now). */
  sprintId: z.uuid().optional(),
});

export const timeTrackingWeekSchema = z.object({
  /** The first day of the week (the window's start, then every seven days). */
  date: z.iso.date(),
  minutes: z.number().int().nonnegative(),
});

export const timeTrackingPersonSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  minutes: z.number().int().nonnegative(),
});

export const timeTrackingIssueSchema = z.object({
  issueId: z.uuid(),
  key: z.string(),
  title: z.string(),
  /** Story points; null when unestimated. */
  estimate: z.number().nonnegative().nullable(),
  minutes: z.number().int().nonnegative(),
});

export const timeTrackingReportSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  totalMinutes: z.number().int().nonnegative(),
  weeks: z.array(timeTrackingWeekSchema),
  people: z.array(timeTrackingPersonSchema),
  /** The most logged first, at most fifty. */
  issues: z.array(timeTrackingIssueSchema),
});

export type TimeTrackingQuery = z.input<typeof timeTrackingQuerySchema>;
export type TimeTrackingWeek = z.infer<typeof timeTrackingWeekSchema>;
export type TimeTrackingPerson = z.infer<typeof timeTrackingPersonSchema>;
export type TimeTrackingIssue = z.infer<typeof timeTrackingIssueSchema>;
export type TimeTrackingReport = z.infer<typeof timeTrackingReportSchema>;
