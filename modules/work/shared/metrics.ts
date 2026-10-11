import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The flow and sprint metrics a board shows, computed from issue_history and
 * the sprints' completion snapshots and cached per board in sprint_metrics.
 * A read reuses the cached row while nothing on the project has changed
 * since it was computed, and recomputes it in place otherwise.
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
  /**
   * Mean days from first entering an in-progress status (or creation, for work
   * that skipped one) to entering a done status, over the last 30 days.
   */
  cycleTimeDays: z.number().nonnegative().nullable(),
  /** Issues entering a done status per week, averaged over the last four weeks. */
  throughputPerWeek: z.number().nonnegative(),
  /** Completions per week over the last eight weeks, oldest first; the Flow sparkline. */
  throughputHistory: z.array(z.number().int().nonnegative()).default([]),
  /** Issues in an in-progress status on the board now. */
  wipCount: z.number().int().nonnegative(),
  /** The active sprint's points, and the points of its issues in a done status. */
  committedPoints: z.number().nonnegative().default(0),
  completedPoints: z.number().nonnegative().default(0),
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
