import { z } from 'zod';
import { deployRuntimeSchema, idSchema, isoDateTimeSchema, slugSchema } from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * A runtime move (journeys proposal, "Switch any time"): changing where an application runs
 * in an environment with a front door plans a traffic move instead of waiting for the next
 * deploy. The new runtime's revision is deployed and becomes healthy, then weight shifts in
 * steps judged by the canary judge, and after a hold the old runtime's revision is removed.
 * Roll back at any step puts every request back on the old runtime.
 *
 * GET /runtime-moves?application= lists an application's moves, newest first;
 * GET /runtime-moves/:id reads one; POST /runtime-moves/:id/start, /pause, /continue and
 * /rollback act on it. PUT /applications/:key/runtimes/:environment creates the plan.
 */

export const moveStateSchema = z.enum([
  'planned',
  'deploying',
  'warming',
  'shifting',
  'holding',
  'paused',
  'succeeded',
  'rolled_back',
  'failed',
  'cancelled',
]);

export const OPEN_MOVE_STATES = [
  'planned',
  'deploying',
  'warming',
  'shifting',
  'holding',
  'paused',
] as const satisfies ReadonlyArray<z.infer<typeof moveStateSchema>>;

export const moveStepSchema = z.object({
  /** Share of requests on the new runtime. */
  percent: z.number().int().min(1).max(100),
  holdMinutes: z.number().int().min(0),
  state: z.enum(['done', 'current', 'next']),
});

/** Rough monthly prices, in dollars, from list prices on a date; never a bill. */
export const moveCostSchema = z.object({
  currency: z.literal('USD'),
  /** "2026-10-29": when the prices were read. */
  pricesAsOf: z.string(),
  estimate: z.literal(true),
  /** What the runtime lines assume runs all month. */
  assumes: z.object({ cpu: z.number(), memoryGiB: z.number(), instances: z.number().int() }),
  lines: z.array(
    z.object({
      item: z.enum(['front-door', 'runtime', 'cluster']),
      runtime: deployRuntimeSchema.nullable(),
      before: z.number(),
      after: z.number(),
    }),
  ),
  before: z.number(),
  after: z.number(),
  /** After less before: what the move adds to the month, or saves when negative. */
  difference: z.number(),
});

export const runtimeMoveSchema = z.object({
  id: idSchema,
  application: z.object({ key: slugSchema, name: z.string() }),
  environment: environmentRefSchema,
  from: deployRuntimeSchema,
  to: deployRuntimeSchema,
  state: moveStateSchema,
  release: z.object({ id: idSchema, version: z.string() }).nullable(),
  steps: z.array(moveStepSchema),
  /** Share of requests on the new runtime now. */
  percent: z.number().int().min(0).max(100),
  /** The address callers keep through the move. */
  frontDoor: z.object({ host: z.string(), url: z.string().nullable() }).nullable(),
  /** Requests lost to the move itself: none, since both runtimes serve until it ends. */
  downtime: z.enum(['none', 'address-change']),
  cost: moveCostSchema,
  /** What has not been proved against the real cloud. */
  untested: z.array(z.string()),
  /** Steps a person does by hand, such as pointing DNS at the address. */
  byHand: z.array(z.string()),
  message: z.string().nullable(),
  can: z.object({
    start: z.boolean(),
    pause: z.boolean(),
    continue: z.boolean(),
    rollBack: z.boolean(),
  }),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  finishedAt: isoDateTimeSchema.nullable(),
});

export const runtimeMovesResponseSchema = z.object({ items: z.array(runtimeMoveSchema) });

export const runtimeMovesQuerySchema = z.object({
  application: slugSchema,
  environment: slugSchema.optional(),
});

export const runtimeMoveParamsSchema = z.object({ id: idSchema });

export const moveActionBodySchema = z.object({ reason: z.string().trim().max(500).optional() });

/** What a runtime card shows about a move in its environment. */
export const moveRefSchema = z.object({
  id: idSchema,
  state: moveStateSchema,
  to: deployRuntimeSchema,
  percent: z.number().int(),
});

export type MoveState = z.infer<typeof moveStateSchema>;
export type MoveStep = z.infer<typeof moveStepSchema>;
export type MoveCost = z.infer<typeof moveCostSchema>;
export type RuntimeMove = z.infer<typeof runtimeMoveSchema>;
export type RuntimeMovesResponse = z.infer<typeof runtimeMovesResponseSchema>;
export type MoveActionBody = z.infer<typeof moveActionBodySchema>;
export type MoveRef = z.infer<typeof moveRefSchema>;
