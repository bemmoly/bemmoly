import { z } from 'zod';

export const livenessResponseSchema = z.object({
  status: z.literal('ok'),
});

export const checkResultSchema = z.object({
  status: z.enum(['ok', 'skipped', 'failed']),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
});

/**
 * `degraded` means the process can answer but a dependency is not configured;
 * `unavailable` means a configured dependency cannot be reached.
 */
export const readinessResponseSchema = z.object({
  status: z.enum(['ready', 'degraded', 'unavailable']),
  checks: z.object({
    database: checkResultSchema,
  }),
});

export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
export type CheckResult = z.infer<typeof checkResultSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
