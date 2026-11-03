import { z } from 'zod';
import { idSchema, providerSchema, slugSchema } from './common.ts';
import { approvalGroupRefSchema } from './roles.ts';

/*
 * Environments, simply (product rule 3): every environment is equal. Each has a name people
 * edit, an ID pipeline files use, a linked cloud project and a place in one ordered promotion
 * path. Everything else is optional and starts off: who can deploy, an approval rule, a deploy
 * window, and which versions may come here. Nothing is keyed on a dev/staging/prod class.
 *
 * Served beside the older environments.ts endpoints until those retire, so both releases work.
 */

const base = '/api/v1/pipelines/environments-v2';

export const ENVIRONMENTS_V2_PATHS = {
  list: base,
  environment: (key: string) => `${base}/${encodeURIComponent(key)}`,
  /** PUT the whole order of the one promotion path. */
  order: `${base}/order`,
} as const;

/** "Production": what people read. */
export const environmentNameSchema = z.string().trim().min(1, 'Name the environment').max(80);

/** "production": what pipeline files and URLs use. */
export const environmentIdSchema = slugSchema;

/** The cloud project (or account) the environment deploys into. */
export const environmentProjectSchema = z.object({
  provider: providerSchema,
  /** "my-company-prod". */
  externalId: z.string().min(1).max(200),
  name: z.string().nullable(),
  region: z.string().nullable(),
  cloudAccountId: idSchema.nullable(),
});

/** Who may deploy here: nobody named means anyone whose role deploys. */
export const environmentDeployersSchema = z
  .object({
    users: z.array(idSchema).max(500).default([]),
    groups: z.array(idSchema).max(50).default([]),
  })
  .nullable();

/** Always, or only when the change request says its risk is high. */
export const approvalConditionSchema = z.enum(['always', 'high_risk']);

export const approvalStepSchema = z.object({
  /** An approval group's id. */
  group: idSchema,
  count: z.number().int().min(1).max(10),
  when: approvalConditionSchema,
});

/** Ordered steps; null is "no approval rule": versions deploy here directly. */
export const approvalRuleSchema = z
  .object({ steps: z.array(approvalStepSchema).min(1).max(10) })
  .nullable();

export const weekdaySchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const clockSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times look like 10:00');

/** When deploys may start here; null is any time. */
export const deployWindowSchema = z
  .object({
    days: z.array(weekdaySchema).min(1).max(7),
    from: clockSchema,
    to: clockSchema,
    /** IANA name, e.g. "Asia/Kolkata". */
    timeZone: z.string().min(1).max(64),
  })
  .nullable();

/** Any version, or only one that already passed the previous environment on the path. */
export const versionsAllowedSchema = z.enum(['any', 'passed_previous']);

export const environmentV2Schema = z.object({
  id: idSchema,
  key: environmentIdSchema,
  name: environmentNameSchema,
  /** 0 first on the path, then left to right. */
  position: z.number().int().min(0),
  project: environmentProjectSchema.nullable(),
  deployers: environmentDeployersSchema,
  approvalRule: approvalRuleSchema,
  window: deployWindowSchema,
  versionsAllowed: versionsAllowedSchema,
});

/** A step as screens show it, with the group's name resolved. */
export const approvalStepViewSchema = approvalStepSchema.extend({
  groupRef: approvalGroupRefSchema,
});

export const environmentV2ViewSchema = environmentV2Schema.extend({
  approvalSteps: z.array(approvalStepViewSchema),
  /** How many services have a version running here. */
  serviceCount: z.number().int().min(0),
});

export const environmentsV2ResponseSchema = z.object({ items: z.array(environmentV2ViewSchema) });

export const createEnvironmentV2BodySchema = z.object({
  name: environmentNameSchema,
  key: environmentIdSchema,
  project: environmentProjectSchema.omit({ name: true }).optional(),
  /** Absent: the end of the path. */
  position: z.number().int().min(0).optional(),
  deployers: environmentDeployersSchema.default(null),
  approvalRule: approvalRuleSchema.default(null),
  window: deployWindowSchema.default(null),
  versionsAllowed: versionsAllowedSchema.default('any'),
});

/** Only what the body names changes; null turns an optional setting off. */
export const updateEnvironmentV2BodySchema = z.object({
  name: environmentNameSchema.optional(),
  key: environmentIdSchema.optional(),
  project: environmentProjectSchema.omit({ name: true }).nullable().optional(),
  deployers: environmentDeployersSchema.optional(),
  approvalRule: approvalRuleSchema.optional(),
  window: deployWindowSchema.optional(),
  versionsAllowed: versionsAllowedSchema.optional(),
});

/** Every environment's key, in the new order. */
export const reorderEnvironmentsBodySchema = z.object({
  keys: z
    .array(environmentIdSchema)
    .min(1)
    .max(50)
    .refine((keys) => new Set(keys).size === keys.length, 'Each environment once'),
});

export type EnvironmentProject = z.infer<typeof environmentProjectSchema>;
export type EnvironmentDeployers = z.infer<typeof environmentDeployersSchema>;
export type ApprovalCondition = z.infer<typeof approvalConditionSchema>;
export type ApprovalStep = z.infer<typeof approvalStepSchema>;
export type ApprovalRule = z.infer<typeof approvalRuleSchema>;
export type Weekday = z.infer<typeof weekdaySchema>;
export type DeployWindow = z.infer<typeof deployWindowSchema>;
export type VersionsAllowed = z.infer<typeof versionsAllowedSchema>;
export type EnvironmentV2 = z.infer<typeof environmentV2Schema>;
export type ApprovalStepView = z.infer<typeof approvalStepViewSchema>;
export type EnvironmentV2View = z.infer<typeof environmentV2ViewSchema>;
export type EnvironmentsV2Response = z.infer<typeof environmentsV2ResponseSchema>;
export type CreateEnvironmentV2Body = z.infer<typeof createEnvironmentV2BodySchema>;
export type UpdateEnvironmentV2Body = z.infer<typeof updateEnvironmentV2BodySchema>;
export type ReorderEnvironmentsBody = z.infer<typeof reorderEnvironmentsBodySchema>;
