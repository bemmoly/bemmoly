import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  environmentClassSchema,
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  scopeRefSchema,
  slugSchema,
} from './common.ts';
import { environmentRefSchema } from './environments.ts';
import { approvalSchema, gateResultSchema } from './promotions.ts';

/*
 * Release trains, coordinated releases and change records (architecture §11):
 * GET/POST /api/v1/pipelines/trains, GET /trains/:id/departures,
 * POST /coordinated-releases, GET /change-records (export as CSV or JSON for audits).
 */

export const trainSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  scope: scopeRefSchema.extend({ name: z.string() }),
  environmentClass: environmentClassSchema,
  /** Cron, e.g. "0 11,16 * * 1-5" for 11:00 and 16:00 on weekdays. */
  schedule: z.string(),
  timezone: z.string(),
  enabled: z.boolean(),
  nextDepartureAt: isoDateTimeSchema.nullable(),
});

export const departureStateSchema = z.enum([
  'boarding',
  'awaiting_approval',
  'rolling_out',
  'departed',
  'cancelled',
]);

export const departureSchema = z.object({
  id: idSchema,
  trainId: idSchema,
  departsAt: isoDateTimeSchema,
  state: departureStateSchema,
  /** "14 services, one approval for all". */
  applicationCount: z.number().int(),
  gatesWaiting: z.number().int(),
  cutAt: isoDateTimeSchema.nullable(),
  finishedAt: isoDateTimeSchema.nullable(),
});

export const createTrainBodySchema = z.object({
  key: slugSchema,
  name: z.string().trim().min(1).max(120),
  scope: scopeRefSchema,
  environmentClass: environmentClassSchema.default('prod'),
  schedule: z.string().min(9).max(120),
  timezone: z.string().min(1).max(60).default('UTC'),
});

export const trainsResponseSchema = z.object({ items: z.array(trainSchema) });
export const listDeparturesQuerySchema = keysetQuerySchema;
export const departuresPageSchema = keysetPageSchema(departureSchema);

/** Several applications in a stated order: schema migration, then API, then web. */
export const coordinatedReleaseBodySchema = z.object({
  to: z.union([slugSchema, environmentClassSchema]),
  promotions: z
    .array(z.object({ release: idSchema, order: z.number().int().min(0) }))
    .min(2)
    .max(100),
  failurePolicy: z.enum(['stop_all', 'continue_independent']).default('stop_all'),
  note: z.string().max(2000).optional(),
});

export const coordinatedReleaseSchema = z.object({
  coordinationId: idSchema,
  promotions: z.array(
    z.object({ id: idSchema, order: z.number().int(), application: applicationRefSchema }),
  ),
});

export const changeOutcomeSchema = z.enum(['succeeded', 'rolled_back', 'cancelled', 'failed']);

/** The immutable evidence a finished promotion leaves, for SOC 2 and ISO 27001. */
export const changeRecordSchema = z.object({
  id: idSchema,
  promotionId: idSchema,
  application: applicationRefSchema,
  environment: environmentRefSchema,
  release: z.object({
    id: idSchema,
    version: z.string(),
    digests: z.record(z.string(), z.string()),
  }),
  outcome: changeOutcomeSchema,
  requestedBy: z.object({ id: idSchema, name: z.string() }).nullable(),
  approvals: z.array(approvalSchema),
  gates: z.array(gateResultSchema),
  timings: z.object({
    requestedAt: isoDateTimeSchema,
    approvedAt: isoDateTimeSchema.nullable(),
    startedAt: isoDateTimeSchema.nullable(),
    finishedAt: isoDateTimeSchema,
  }),
  createdAt: isoDateTimeSchema,
});

export const listChangeRecordsQuerySchema = keysetQuerySchema.extend({
  application: slugSchema.optional(),
  environment: slugSchema.optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const changeRecordsPageSchema = keysetPageSchema(changeRecordSchema);

export type Train = z.infer<typeof trainSchema>;
export type DepartureState = z.infer<typeof departureStateSchema>;
export type Departure = z.infer<typeof departureSchema>;
export type CreateTrainBody = z.input<typeof createTrainBodySchema>;
export type TrainsResponse = z.infer<typeof trainsResponseSchema>;
export type DeparturesPage = z.infer<typeof departuresPageSchema>;
export type CoordinatedReleaseBody = z.input<typeof coordinatedReleaseBodySchema>;
export type CoordinatedRelease = z.infer<typeof coordinatedReleaseSchema>;
export type ChangeOutcome = z.infer<typeof changeOutcomeSchema>;
export type ChangeRecord = z.infer<typeof changeRecordSchema>;
export type ListChangeRecordsQuery = z.input<typeof listChangeRecordsQuerySchema>;
export type ChangeRecordsPage = z.infer<typeof changeRecordsPageSchema>;
