import { z } from 'zod';
import { issuePrioritySchema } from './enums.ts';

/*
 * Reports asked for in words. The model never writes a query: it fills in a report spec, a
 * closed vocabulary of metric, grouping, filters and chart, which is validated here and run
 * by the server against the project's issues with the asker's permissions. A pinned report
 * stores the spec, never the numbers, so it is rebuilt live each time it is shown.
 */

/**
 * What is measured over each group: issues counted, story points summed, open issues
 * counted, the average days from created to resolved, or the share of issues done.
 */
export const REPORT_METRICS = [
  'issues',
  'points',
  'open_issues',
  'open_points',
  'avg_resolution_days',
  'progress',
] as const;
export const reportMetricSchema = z.enum(REPORT_METRICS);

/** One row per value of this field; `none` is a single number for the whole selection. */
export const REPORT_GROUPS = [
  'none',
  'status',
  'assignee',
  'type',
  'priority',
  'label',
  'epic',
  'sprint',
] as const;
export const reportGroupSchema = z.enum(REPORT_GROUPS);

export const REPORT_CHARTS = ['bar', 'table', 'number'] as const;
export const reportChartSchema = z.enum(REPORT_CHARTS);

export const REPORT_STATUS_FILTERS = ['any', 'open', 'todo', 'in_progress', 'done'] as const;
export const REPORT_SPRINT_FILTERS = ['any', 'active'] as const;
export const REPORT_ASSIGNEE_FILTERS = ['any', 'me', 'unassigned'] as const;

/** Which issues the report reads; every key narrows, and an empty object is every issue. */
export const reportFiltersSchema = z.object({
  status: z.enum(REPORT_STATUS_FILTERS).optional(),
  sprint: z.enum(REPORT_SPRINT_FILTERS).optional(),
  assignee: z.enum(REPORT_ASSIGNEE_FILTERS).optional(),
  /** Issue type names as the project names them, matched without case. */
  types: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  priorities: z.array(issuePrioritySchema).max(5).optional(),
  createdWithinDays: z.number().int().min(1).max(730).optional(),
  resolvedWithinDays: z.number().int().min(1).max(730).optional(),
});

export const reportSpecSchema = z.object({
  /** A short name for the report, in sentence case. */
  title: z.string().trim().min(1).max(120),
  metric: reportMetricSchema,
  groupBy: reportGroupSchema,
  filters: reportFiltersSchema,
  chart: reportChartSchema,
});

export const REPORT_UNITS = ['issues', 'points', 'days', 'percent'] as const;
export const reportUnitSchema = z.enum(REPORT_UNITS);

export const reportRowSchema = z.object({
  /** The group's id; null is the "none" bucket (Unassigned, No epic, ...). */
  id: z.string().nullable(),
  label: z.string(),
  value: z.number(),
  /** Issues behind the value. */
  issues: z.number().int().nonnegative(),
});

export const reportResultSchema = z.object({
  spec: reportSpecSchema,
  unit: reportUnitSchema,
  rows: z.array(reportRowSchema),
  /** The metric over the whole selection, which is not always the sum of the rows. */
  total: z.number(),
  /** Distinct issues the filters selected. */
  issues: z.number().int().nonnegative(),
  generatedAt: z.iso.datetime(),
});

export const askReportBodySchema = z.object({
  question: z.string().trim().min(3).max(500),
});

export const askReportResponseSchema = z.object({
  question: z.string(),
  result: reportResultSchema,
  /** The ai_runs row, for "Not useful". */
  runId: z.string(),
});

export const runReportBodySchema = z.object({ spec: reportSpecSchema });

export const createPinnedReportBodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  spec: reportSpecSchema,
});

export const pinnedReportSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  question: z.string(),
  spec: reportSpecSchema,
  createdAt: z.iso.datetime(),
});

/** A pin with its report rebuilt now; `error` when the spec no longer runs. */
export const pinnedReportViewSchema = pinnedReportSchema.extend({
  result: reportResultSchema.nullable(),
  error: z.string().nullable(),
});

export const pinnedReportListSchema = z.object({ items: z.array(pinnedReportViewSchema) });

/** At most this many pins per person and project; the Reports view stays a page, not a feed. */
export const MAX_PINNED_REPORTS = 24;

export type ReportMetric = z.infer<typeof reportMetricSchema>;
export type ReportGroup = z.infer<typeof reportGroupSchema>;
export type ReportChart = z.infer<typeof reportChartSchema>;
export type ReportFilters = z.infer<typeof reportFiltersSchema>;
export type ReportSpec = z.infer<typeof reportSpecSchema>;
export type ReportUnit = z.infer<typeof reportUnitSchema>;
export type ReportRow = z.infer<typeof reportRowSchema>;
export type ReportResult = z.infer<typeof reportResultSchema>;
export type AskReportBody = z.infer<typeof askReportBodySchema>;
export type AskReportResponse = z.infer<typeof askReportResponseSchema>;
export type CreatePinnedReportBody = z.infer<typeof createPinnedReportBodySchema>;
export type PinnedReport = z.infer<typeof pinnedReportSchema>;
export type PinnedReportView = z.infer<typeof pinnedReportViewSchema>;
