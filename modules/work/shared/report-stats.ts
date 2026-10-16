import { z } from 'zod';

/*
 * Field statistics: how the project's open and closed issues spread over one
 * field, or over two crossed. Counted on read from the issues as they stand.
 */

/** Fields an issue can be grouped by. Labels and assignees hold several values per issue. */
export const STAT_FIELDS = [
  'status',
  'assignee',
  'type',
  'priority',
  'label',
  'epic',
  'version',
  'component',
] as const;
export const statFieldSchema = z.enum(STAT_FIELDS);

export const reportStatsQuerySchema = z.object({
  by: statFieldSchema.default('status'),
  by2: statFieldSchema.optional(),
});

/** One value of a field; null is the "none" bucket (Unassigned, No epic, ...). */
export const statBucketSchema = z.object({
  id: z.string().nullable(),
  label: z.string(),
});

export const statRowSchema = statBucketSchema.extend({
  count: z.number().int().nonnegative(),
});

export const statCellSchema = z.object({
  row: z.string().nullable(),
  column: z.string().nullable(),
  count: z.number().int().positive(),
});

export const reportStatsSchema = z.object({
  by: statFieldSchema,
  by2: statFieldSchema.nullable(),
  rows: z.array(statRowSchema),
  /** Present only with `by2`; empty cells are left out. */
  columns: z.array(statBucketSchema).optional(),
  cells: z.array(statCellSchema).optional(),
  /**
   * Distinct issues. With a many-valued field (label, assignee) one issue
   * counts in each of its buckets, so the rows can add up to more than this.
   */
  total: z.number().int().nonnegative(),
});

export type StatField = z.infer<typeof statFieldSchema>;
export type ReportStatsQuery = z.input<typeof reportStatsQuerySchema>;
export type StatBucket = z.infer<typeof statBucketSchema>;
export type StatRow = z.infer<typeof statRowSchema>;
export type StatCell = z.infer<typeof statCellSchema>;
export type ReportStats = z.infer<typeof reportStatsSchema>;
