import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  idSchema,
  isoDateTimeSchema,
  personRefSchema,
  scopePathSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';

/*
 * What changed?: GET /api/v1/pipelines/changes?scope=commerce&window=3h. Every deploy, roll
 * back, config, environment, access, policy and infrastructure change in a scope and window,
 * newest first, over the error rate. Changes that landed just before a rise are marked by
 * timing alone; the product does not guess beyond that.
 */

export const changeKindSchema = z.enum([
  'deploy',
  'rollback',
  'config',
  'environment',
  'access',
  'policy',
  'infrastructure',
]);

export const changeWindowSchema = z.enum(['1h', '3h', '24h', '7d']);

export const changesQuerySchema = z.object({
  scope: scopePathSchema.optional(),
  window: changeWindowSchema.default('3h'),
  /** An explicit range wins over `window`. */
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  /** Also show changes to applications that call this one. */
  includeCallersOf: slugSchema.optional(),
  kinds: z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
    .pipe(z.array(changeKindSchema).max(7))
    .optional(),
  /** Only changes that touched a Prod environment. */
  prodOnly: z.stringbool().optional(),
});

export const changeItemSchema = z.object({
  id: idSchema,
  kind: changeKindSchema,
  occurredAt: isoDateTimeSchema,
  application: applicationRefSchema.nullable(),
  environment: environmentRefSchema.nullable(),
  actor: personRefSchema.nullable(),
  /** "Platform" when no person did it. */
  actorLabel: z.string().nullable(),
  /** "Deploy · pricing-svc v2.18.0 to Prod us-east1". */
  summary: z.string(),
  detail: z.string().nullable(),
  /** Roll back or Revert is offered when true. */
  revertible: z.boolean(),
  ref: z.object({ kind: z.string(), id: idSchema }).nullable(),
  /** "3 minutes before the rise": set when the change lands shortly before the series rises. */
  beforeRiseMinutes: z.number().int().min(0).nullable(),
});

export const errorSeriesSchema = z.object({
  /** "5xx rate, all Commerce applications". */
  label: z.string(),
  /** "unavailable" when no metrics source is connected; the chart then says so. */
  source: z.enum(['metrics', 'unavailable']),
  points: z.array(z.tuple([isoDateTimeSchema, z.number()])),
  /** When the series started rising, if it did. */
  riseAt: isoDateTimeSchema.nullable(),
});

export const changesResponseSchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  items: z.array(changeItemSchema),
  /** "27 changes · 5 that touched Prod". */
  counts: z.object({ total: z.number().int(), prod: z.number().int() }),
  series: errorSeriesSchema,
});

export type ChangeKind = z.infer<typeof changeKindSchema>;
export type ChangeWindow = z.infer<typeof changeWindowSchema>;
export type ChangesQuery = z.input<typeof changesQuerySchema>;
export type ChangeItem = z.infer<typeof changeItemSchema>;
export type ErrorSeries = z.infer<typeof errorSeriesSchema>;
export type ChangesResponse = z.infer<typeof changesResponseSchema>;
