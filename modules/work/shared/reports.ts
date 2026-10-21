import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The Reports screen's project-wide series, rebuilt from issue_history on
 * read: the cumulative flow by status category and created against resolved,
 * one point per UTC day. Nothing is stored.
 */

export const flowReportQuerySchema = z.object({
  /** How many days back the series reach, today included. */
  days: z.coerce.number().int().min(7).max(180).default(30),
});

export const flowReportDaySchema = z.object({
  date: z.iso.date(),
  /** Issues standing in each status category at the end of the day. */
  todo: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  /** Issues created that day, and issues that entered a done status from an open one. */
  created: z.number().int().nonnegative(),
  resolved: z.number().int().nonnegative(),
});

export const flowReportSchema = z.object({
  projectId: z.uuid(),
  days: z.array(flowReportDaySchema),
});

/** One issue in the sprint report's lists. */
export const sprintReportIssueSchema = z.object({
  issueId: z.uuid(),
  key: z.string(),
  title: z.string(),
  estimate: z.number().nonnegative().nullable(),
});

/** What the sprint held at its end, and how its scope moved after it started. */
export const sprintScopeSchema = z.object({
  completed: z.array(sprintReportIssueSchema),
  notCompleted: z.array(sprintReportIssueSchema),
  /** In the sprint at its end but not when it started. */
  added: z.array(sprintReportIssueSchema),
  /** In the sprint when it started but gone by its end, finished or not. */
  removed: z.array(sprintReportIssueSchema),
  /** In the sprint when it started, handed on unfinished by a sprint that closed before it. */
  carriedOver: z.array(sprintReportIssueSchema).default([]),
});

const count = z.number().int().nonnegative().default(0);
const pointsField = z.number().nonnegative().default(0);

/**
 * How a sprint's scope moved, as totals: what it held at its end (now, for an
 * active one), the spillover a previous sprint handed it, and the work that
 * joined after the start and was still in at the end. Shares are left to the
 * reader, from the added and scope figures.
 */
export const sprintChangesSchema = z.object({
  scopeIssues: count,
  scopePoints: pointsField,
  carriedOverIssues: count,
  carriedOverPoints: pointsField,
  addedIssues: count,
  addedPoints: pointsField,
});

export const burnupPointSchema = z.object({
  date: z.iso.date(),
  /** Points the sprint held at the end of the day. */
  scopePoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
});

export type FlowReportQuery = z.input<typeof flowReportQuerySchema>;
export type FlowReportDay = z.infer<typeof flowReportDaySchema>;
export type FlowReport = z.infer<typeof flowReportSchema>;
export type SprintReportIssue = z.infer<typeof sprintReportIssueSchema>;
export type SprintScope = z.infer<typeof sprintScopeSchema>;
export type SprintChanges = z.infer<typeof sprintChangesSchema>;
export type BurnupPoint = z.infer<typeof burnupPointSchema>;

/** The window the control chart and time in status read, as days back from today. */
export const cycleReportQuerySchema = z.object({
  days: z.coerce.number().int().min(7).max(365).default(90),
});

/** One finished issue on the control chart. */
export const controlPointSchema = z.object({
  issueId: z.uuid(),
  key: z.string(),
  title: z.string(),
  completedAt: timestampSchema,
  /** Days from first entering an in-progress status (or creation) to entering done. */
  cycleDays: z.number().nonnegative(),
});

export const controlChartSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  points: z.array(controlPointSchema),
  meanDays: z.number().nonnegative().nullable(),
  medianDays: z.number().nonnegative().nullable(),
});

export const statusTimeSchema = z.object({
  statusId: z.uuid(),
  name: z.string(),
  category: z.enum(['todo', 'in_progress', 'done']),
  /** Mean days an issue that stood in the status spent there inside the window. */
  averageDays: z.number().nonnegative(),
  issues: z.number().int().nonnegative(),
});

export const timeInStatusSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  statuses: z.array(statusTimeSchema),
});

export const scopeKindSchema = z.enum(['epic', 'version']);

export const scopeReportQuerySchema = z.object({
  kind: scopeKindSchema.default('epic'),
  /** The epic or version; the first open one when absent. */
  id: z.uuid().optional(),
  weeks: z.coerce.number().int().min(4).max(52).default(12),
});

export const scopeTargetSchema = z.object({
  id: z.uuid(),
  /** An epic's key and title, or a version's name. */
  label: z.string(),
  done: z.boolean(),
});

export const scopeWeekSchema = z.object({
  date: z.iso.date(),
  scopePoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
  scopeIssues: z.number().int().nonnegative(),
  completedIssues: z.number().int().nonnegative(),
});

/** An epic's or version's points week by week, with what else could be chosen. */
export const scopeReportSchema = z.object({
  kind: scopeKindSchema,
  targets: z.array(scopeTargetSchema),
  target: scopeTargetSchema.nullable(),
  weeks: z.array(scopeWeekSchema),
});

export type CycleReportQuery = z.input<typeof cycleReportQuerySchema>;
export type ControlPoint = z.infer<typeof controlPointSchema>;
export type ControlChart = z.infer<typeof controlChartSchema>;
export type StatusTime = z.infer<typeof statusTimeSchema>;
export type TimeInStatus = z.infer<typeof timeInStatusSchema>;
export type ScopeKind = z.infer<typeof scopeKindSchema>;
export type ScopeReportQuery = z.input<typeof scopeReportQuerySchema>;
export type ScopeTarget = z.infer<typeof scopeTargetSchema>;
export type ScopeWeek = z.infer<typeof scopeWeekSchema>;
export type ScopeReport = z.infer<typeof scopeReportSchema>;
