import { z } from 'zod';
import { applicationRefSchema } from './catalog.ts';
import {
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  scopePathSchema,
  slugSchema,
  teamRefSchema,
} from './common.ts';
import { inputTypeSchema, scalarSchema, scheduleSpecSchema } from './pipeline-spec.ts';

/*
 * What Pipelines learns from test reports and failures, and what an application's pipeline
 * asks of a person before it runs:
 *   GET    /applications/:key/pipeline            inputs for "Run pipeline…", schedules
 *   GET    /applications/:key/tests?state=flaky   flaky and quarantined tests
 *   POST   /applications/:key/tests/quarantines   quarantine one test (owning team)
 *   DELETE /applications/:key/tests/quarantines/:id
 *   GET    /failures?since=&application=          identical failures grouped across runs
 */

/** One field of the "Run pipeline…" form. */
export const runInputFieldSchema = z.object({
  name: z.string(),
  type: inputTypeSchema,
  default: scalarSchema.nullable(),
  description: z.string().nullable(),
  required: z.boolean(),
  options: z.array(z.string()).nullable(),
  /** Declared by the template rather than the application. */
  fromTemplate: z.boolean(),
});

export const scheduleSchema = scheduleSpecSchema.extend({
  /** When it next starts a run, in UTC. */
  nextRunAt: isoDateTimeSchema.nullable(),
});

export const applicationPipelineSchema = z.object({
  application: applicationRefSchema,
  /** Where the definition came from: `.bemmoly/application.yaml`, or none yet. */
  source: z.enum(['repository', 'catalog', 'none']),
  template: z.object({ ref: z.string(), version: z.number().int() }).nullable(),
  defaultRef: z.string(),
  /** In declared order: the template's first, then the application's own. */
  inputs: z.array(runInputFieldSchema),
  schedules: z.array(scheduleSchema),
  /** The definition as written, for "view the pipeline". */
  definition: z.unknown().nullable(),
});

export const testStateFilterSchema = z.enum(['flaky', 'quarantined', 'all']);

/** One test, by file and name, with what Pipelines learned about it. */
export const testStatusSchema = z.object({
  id: idSchema,
  file: z.string(),
  name: z.string(),
  /** "retry": failed then passed on the same commit; "intermittent": flips on main. */
  flaky: z.enum(['retry', 'intermittent']).nullable(),
  flakySince: isoDateTimeSchema.nullable(),
  failedRecent: z.number().int().min(0),
  ofRecent: z.number().int().min(0),
  lastFailedAt: isoDateTimeSchema.nullable(),
  quarantine: z
    .object({
      by: personRefSchema.nullable(),
      at: isoDateTimeSchema,
      reason: z.string(),
    })
    .nullable(),
  /** The application's owning team, who may quarantine and release it. */
  owner: teamRefSchema.nullable(),
});

export const listTestsQuerySchema = keysetQuerySchema.extend({
  state: testStateFilterSchema.default('flaky'),
});

export const testsPageSchema = keysetPageSchema(testStatusSchema);

export const quarantineBodySchema = z.object({
  file: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
  reason: z.string().trim().min(1).max(500),
});

export const quarantineParamsSchema = z.object({ key: slugSchema, id: idSchema });

/** Identical failures across runs: the first error line with numbers, ids and paths masked. */
export const failureGroupSchema = z.object({
  fingerprint: z.string(),
  /** The normalised line: "Cannot connect to <host>:<n>". */
  text: z.string(),
  /** One line exactly as it was written. */
  sample: z.string(),
  occurrences: z.number().int().min(1),
  runs: z.number().int().min(1),
  applications: z.array(applicationRefSchema),
  firstSeenAt: isoDateTimeSchema,
  lastSeenAt: isoDateTimeSchema,
  /** The most recent failing job, to open its log at the line. */
  latestJobId: idSchema,
});

export const listFailuresQuerySchema = z.object({
  since: isoDateTimeSchema.optional(),
  scope: scopePathSchema.optional(),
  application: slugSchema.optional(),
  fingerprint: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const failureGroupsSchema = z.object({ items: z.array(failureGroupSchema) });

export type RunInputField = z.infer<typeof runInputFieldSchema>;
export type Schedule = z.infer<typeof scheduleSchema>;
export type ApplicationPipeline = z.infer<typeof applicationPipelineSchema>;
export type TestStateFilter = z.infer<typeof testStateFilterSchema>;
export type TestStatus = z.infer<typeof testStatusSchema>;
export type ListTestsQuery = z.input<typeof listTestsQuerySchema>;
export type TestsPage = z.infer<typeof testsPageSchema>;
export type QuarantineBody = z.infer<typeof quarantineBodySchema>;
export type FailureGroup = z.infer<typeof failureGroupSchema>;
export type ListFailuresQuery = z.input<typeof listFailuresQuerySchema>;
export type FailureGroups = z.infer<typeof failureGroupsSchema>;
