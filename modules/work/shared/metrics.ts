import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The flow and sprint metrics a board shows, computed from issue_history and
 * the sprints' completion snapshots and cached per board. The quiet-period
 * job recomputes them after the board changes; a read on an empty cache
 * computes them in place.
 */

export const velocityPointSchema = z.object({
  sprintId: z.uuid(),
  name: z.string(),
  committedPoints: z.number().nonnegative(),
  completedPoints: z.number().nonnegative(),
});

export const burndownPointSchema = z.object({
  date: z.iso.date(),
  remainingPoints: z.number().nonnegative(),
});

export const boardMetricsSchema = z.object({
  boardId: z.uuid(),
  /** Last closed sprints of the board's project, oldest first. */
  velocity: z.array(velocityPointSchema),
  /** The active sprint's burndown, one point per day from its start; empty without one. */
  burndown: z.array(burndownPointSchema),
  sprintId: z.uuid().nullable(),
  /** Mean days from creation to resolution over the last 30 days of resolved work. */
  cycleTimeDays: z.number().nonnegative().nullable(),
  /** Resolved issues per week over the last four weeks. */
  throughputPerWeek: z.number().nonnegative(),
  wipCount: z.number().int().nonnegative(),
  computedAt: timestampSchema,
});

export const boardMetricsQuerySchema = z.object({
  /** How many closed sprints the velocity series covers. */
  sprints: z.coerce.number().int().min(1).max(20).default(6),
});

export type VelocityPoint = z.infer<typeof velocityPointSchema>;
export type BurndownPoint = z.infer<typeof burndownPointSchema>;
export type BoardMetrics = z.infer<typeof boardMetricsSchema>;
export type BoardMetricsQuery = z.infer<typeof boardMetricsQuerySchema>;
