import { z } from 'zod';
import { idSchema, scopePathSchema, slugSchema } from './common.ts';

/*
 * GET /api/v1/pipelines/overview?scope=commerce: the numbers in For you's header
 * ("Acme today: 1,284 runs · 212 deploys to Prod · 2.1% change failure · 3h 10m median lead
 * time") and the top bar's live counter. One request, one round of aggregate reads.
 */

export const overviewQuerySchema = z.object({
  scope: scopePathSchema.optional(),
});

export const liveCounterSchema = z.object({
  running: z.number().int(),
  queued: z.number().int(),
});

export const overviewSchema = z.object({
  /** The organisation's name, then the domain and group the scope names. */
  scope: z.object({
    organisation: z.string(),
    domain: z.object({ id: idSchema, key: slugSchema, name: z.string() }).nullable(),
    group: z.object({ id: idSchema, key: slugSchema, name: z.string() }).nullable(),
  }),
  /** Since midnight in the server's day, for this scope. */
  today: z.object({
    runs: z.number().int(),
    prodDeploys: z.number().int(),
    /** Over the last 30 days, 0 to 1; null before the first Prod deploy. */
    changeFailureRate: z.number().min(0).max(1).nullable(),
    /** Median commit-to-Prod over the last 30 days, in seconds. */
    leadTimeSeconds: z.number().int().nullable(),
  }),
  live: liveCounterSchema,
  catalog: z.object({
    applications: z.number().int(),
    domains: z.number().int(),
    teams: z.number().int(),
  }),
  /** The person, for "Good morning, Priya". */
  me: z.object({ id: idSchema, name: z.string(), firstName: z.string() }),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema>;
export type LiveCounter = z.infer<typeof liveCounterSchema>;
export type Overview = z.infer<typeof overviewSchema>;
