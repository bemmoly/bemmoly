import { z } from 'zod';
import { domainColorSchema } from './catalog.ts';
import {
  currentStateSchema,
  idSchema,
  isoDateTimeSchema,
  runStateSchema,
  runtimeSchema,
  slugSchema,
} from './common.ts';
import { changeRequestNumberSchema, changeRequestStatusSchema } from './change-requests.ts';

/*
 * The reads behind Services, a service's page and For you in the simpler Pipelines: every
 * service by domain with the version running in each environment, a service's versions and
 * where each runs, and the developer's For you. Read models only; nothing here changes state.
 * Environments come in path order and carry no class: they are equal (product rule 3).
 */

const base = '/api/v1/pipelines';

export const SERVICE_VIEWS_PATHS = {
  list: `${base}/services`,
  versions: (key: string) => `${base}/services/${encodeURIComponent(key)}/versions`,
  forYou: `${base}/for-you/summary`,
} as const;

/** One column of the services table: an environment on the path. */
export const serviceEnvironmentSchema = z.object({
  key: slugSchema,
  name: z.string(),
  position: z.number().int(),
  /** Versions reach it through a change request. */
  hasApprovalRule: z.boolean(),
  /** The cloud project it deploys into, for "Open in Cloud Logging". */
  project: z.string().nullable(),
  region: z.string().nullable(),
});

/** A change request moving a version of this service, as a chip: "CHG-1042 · 1 of 2". */
export const serviceChangeRefSchema = z.object({
  number: changeRequestNumberSchema,
  status: changeRequestStatusSchema,
  approvals: z.number().int().min(0),
  needed: z.number().int().min(0),
});

/** What runs in one environment: absent from the list when nothing has been deployed. */
export const serviceRunningSchema = z.object({
  environment: slugSchema,
  version: z.string().nullable(),
  releaseId: idSchema.nullable(),
  commitSha: z.string().nullable(),
  /** The commit's title, from the run that built the version. */
  message: z.string().nullable(),
  state: currentStateSchema,
  movingVersion: z.string().nullable(),
  trafficPercent: z.number().int().min(0).max(100),
  deployedAt: isoDateTimeSchema.nullable(),
  /** A person's name, or null when a pipeline or a change request deployed it. */
  deployedBy: z.string().nullable(),
  /** The change request that is moving a newer version here, if one is open. */
  pending: serviceChangeRefSchema.nullable(),
});

export const serviceLastRunSchema = z.object({
  id: idSchema,
  number: z.number().int(),
  state: runStateSchema,
  createdAt: isoDateTimeSchema,
});

export const serviceRowSchema = z.object({
  id: idSchema,
  key: slugSchema,
  name: z.string(),
  kind: runtimeSchema,
  path: z.string(),
  repository: z.string().nullable(),
  domain: z.object({ key: slugSchema, name: z.string(), color: domainColorSchema }),
  team: z.object({ id: idSchema, name: z.string() }).nullable(),
  running: z.array(serviceRunningSchema),
  lastRun: serviceLastRunSchema.nullable(),
});

export const listServicesQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  domain: slugSchema.optional(),
  team: idSchema.optional(),
  /** Only services owned by a team the person is in. */
  mine: z.stringbool().optional(),
});

export const servicesResponseSchema = z.object({
  environments: z.array(serviceEnvironmentSchema),
  domains: z.array(
    z.object({ key: slugSchema, name: z.string(), color: domainColorSchema, count: z.number() }),
  ),
  teams: z.array(z.object({ id: idSchema, name: z.string() })),
  items: z.array(serviceRowSchema),
  /** Services that matched before the cap; the list shows the first 500. */
  total: z.number().int(),
});

/** One version of a service: every build that passed its tests (product rule 6). */
export const serviceVersionSchema = z.object({
  releaseId: idSchema,
  version: z.string(),
  commitSha: z.string(),
  message: z.string().nullable(),
  createdAt: isoDateTimeSchema,
  createdBy: z.string().nullable(),
  tests: z.object({ passed: z.number().int(), failed: z.number().int() }).nullable(),
  run: z.object({ id: idSchema, number: z.number().int() }).nullable(),
  /** Environment keys where this version runs now. */
  runningIn: z.array(slugSchema),
  /** The latest change request that carried it. */
  change: serviceChangeRefSchema.nullable(),
});

export const serviceVersionsResponseSchema = z.object({
  environments: z.array(serviceEnvironmentSchema),
  items: z.array(serviceVersionSchema),
});

/** Something on For you that waits on the person: a failure, or their change request. */
export const forYouNeedSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('failed_run'),
    run: z.object({ id: idSchema, number: z.number().int(), title: z.string() }),
    service: slugSchema.nullable(),
    commitSha: z.string(),
    at: isoDateTimeSchema,
  }),
  z.object({
    kind: z.literal('change_request'),
    number: changeRequestNumberSchema,
    title: z.string(),
    status: changeRequestStatusSchema,
    environment: z.string(),
    approvals: z.number().int(),
    needed: z.number().int(),
    services: z.array(z.object({ key: slugSchema, version: z.string() })),
  }),
]);

export const forYouSummarySchema = z.object({
  /** The last environment on the path, which the stats and "Your services" name. */
  lastEnvironment: z.object({ key: slugSchema, name: z.string() }).nullable(),
  environments: z.array(serviceEnvironmentSchema),
  stats: z.object({
    deploysThisWeek: z.number().int(),
    deploysLastWeek: z.number().int(),
    changesToLast: z.object({
      total: z.number().int(),
      approved: z.number().int(),
      rejected: z.number().int(),
    }),
    /** Median from sending a change request to its deploy, over 30 days. */
    approvalMedianSeconds: z.number().int().nullable(),
    failingNow: z.number().int(),
    /** The first failing service, for "supplier on Dev". */
    firstFailing: z.object({ service: slugSchema, environment: z.string() }).nullable(),
  }),
  needsYou: z.array(forYouNeedSchema).max(10),
  /** Services owned by the person's teams, or the ones they ran lately. */
  yourServices: z
    .array(
      z.object({
        key: slugSchema,
        name: z.string(),
        kind: runtimeSchema,
        domain: z.string(),
        lastVersion: z.string().nullable(),
        states: z.array(
          z.object({ environment: slugSchema, state: currentStateSchema.nullable() }),
        ),
      }),
    )
    .max(12),
});

export type ServiceEnvironment = z.infer<typeof serviceEnvironmentSchema>;
export type ServiceChangeRef = z.infer<typeof serviceChangeRefSchema>;
export type ServiceRunning = z.infer<typeof serviceRunningSchema>;
export type ServiceRow = z.infer<typeof serviceRowSchema>;
export type ListServicesQuery = z.infer<typeof listServicesQuerySchema>;
export type ServicesResponse = z.infer<typeof servicesResponseSchema>;
export type ServiceVersion = z.infer<typeof serviceVersionSchema>;
export type ServiceVersionsResponse = z.infer<typeof serviceVersionsResponseSchema>;
export type ForYouNeed = z.infer<typeof forYouNeedSchema>;
export type ForYouSummary = z.infer<typeof forYouSummarySchema>;
