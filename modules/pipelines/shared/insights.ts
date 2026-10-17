import { z } from 'zod';
import { domainColorSchema } from './catalog.ts';
import { isoDateTimeSchema, scopePathSchema } from './common.ts';

/*
 * Insights: GET /api/v1/pipelines/insights?scope=commerce&range=90d. The four delivery
 * measures (lead time, deploy frequency, change failure rate, time to restore) for a scope,
 * week by week, then one row per domain, group or team beneath it. Read from the daily
 * rollups, so the screen is one request however large the organisation.
 */

export const insightsRangeSchema = z.enum(['30d', '90d', '180d']);
/** What the rows under the measures are: the scope's children, or the teams that own them. */
export const insightsBreakdownSchema = z.enum(['scope', 'team']);

export const insightsQuerySchema = z.object({
  scope: scopePathSchema.optional(),
  range: insightsRangeSchema.default('90d'),
  by: insightsBreakdownSchema.default('scope'),
});

/** One measure over the range, the range before it, and a point per week. */
export const insightsMeasureSchema = z.object({
  /** Null when nothing reached Prod in the range, so there is nothing to measure. */
  value: z.number().nullable(),
  previous: z.number().nullable(),
  weeks: z.array(z.object({ start: isoDateTimeSchema, value: z.number().nullable() })),
});

export const insightsMeasuresSchema = z.object({
  /** Median commit to Prod, in seconds. */
  leadTime: insightsMeasureSchema,
  /** Prod deploys per day. */
  deployFrequency: insightsMeasureSchema,
  /** Prod deploys that failed or were rolled back, 0 to 1. */
  changeFailureRate: insightsMeasureSchema,
  /** Median from a failed Prod deploy to its roll back finishing, in seconds. */
  timeToRestore: insightsMeasureSchema,
});

export const insightsRowSchema = z.object({
  kind: z.enum(['domain', 'group', 'team']),
  /** A domain or group key, or a team id; the screen zooms into a domain or group row. */
  key: z.string(),
  name: z.string(),
  /** The domain's tile hue, for domain rows. */
  color: domainColorSchema.nullable(),
  applications: z.number().int(),
  prodDeploys: z.number().int(),
  leadTimeSeconds: z.number().nullable(),
  deploysPerDay: z.number().nullable(),
  changeFailureRate: z.number().nullable(),
  timeToRestoreSeconds: z.number().nullable(),
});

export const insightsSchema = z.object({
  range: insightsRangeSchema,
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  measures: insightsMeasuresSchema,
  by: insightsBreakdownSchema,
  rows: z.array(insightsRowSchema),
});

export type InsightsRange = z.infer<typeof insightsRangeSchema>;
export type InsightsBreakdown = z.infer<typeof insightsBreakdownSchema>;
export type InsightsQuery = z.input<typeof insightsQuerySchema>;
export type InsightsMeasure = z.infer<typeof insightsMeasureSchema>;
export type InsightsMeasures = z.infer<typeof insightsMeasuresSchema>;
export type InsightsRow = z.infer<typeof insightsRowSchema>;
export type Insights = z.infer<typeof insightsSchema>;
