import { z } from 'zod';
import { deployRuntimeSchema, slugSchema } from './common.ts';
import { deploySettingFieldSchema, deploySettingValueSchema } from './deploy-settings.ts';
import { environmentRefSchema } from './environments.ts';
import { variableNameSchema } from './variables.ts';

/*
 * Copying configuration from one environment to another, such as Stage to a fresh Prod.
 * GET /environments/:key/copies?from=<key>&applications=<a,b> is the plan for copying into
 * :key: every item that differs, per application. POST /environments/:key/copies applies the
 * items ticked. Plain variables copy as they are, and references stay references. A secret
 * is copied store to store (the value passes through the server in memory once) or left
 * needing a value. Deploy settings are translated to the target's runtime. The runtime
 * choice, addresses and deployments are never copied. Copying again shows only what differs.
 */

/** "copy": store to store. "needs-value": the name only, for someone to set by hand. */
export const copySecretModeSchema = z.enum(['copy', 'needs-value']);

/** Why a setting is not ticked: the target runtime has no such setting, or keeps its default. */
export const copySettingNoteSchema = z.enum(['dropped', 'keeps-default']);

export const copyItemSchema = z.discriminatedUnion('kind', [
  z.object({
    /** "checkout-api:variable:LOG_LEVEL", stable between plan and apply. */
    id: z.string(),
    kind: z.literal('variable'),
    name: variableNameSchema,
    /** The target's own value now; null when it has none. */
    before: z.string().nullable(),
    after: z.string(),
    /** The value names another application's address, filled in per environment. */
    reference: z.boolean(),
    ticked: z.boolean(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('secret'),
    name: variableNameSchema,
    /** Where the source's value lives. */
    location: z.string(),
    /** The choice the plan starts with: needs-value for a prod-class target. */
    mode: copySecretModeSchema,
    ticked: z.boolean(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('setting'),
    field: deploySettingFieldSchema,
    /** What the target's next deploy uses now, and would with the copied value. */
    before: deploySettingValueSchema,
    after: deploySettingValueSchema,
    /** False when the target's runtime has no such setting; it is dropped. */
    applies: z.boolean(),
    note: copySettingNoteSchema.nullable(),
    ticked: z.boolean(),
  }),
]);

export const copyApplicationSchema = z.object({
  application: z.object({ key: slugSchema, name: z.string() }),
  runtime: z.object({ from: deployRuntimeSchema, to: deployRuntimeSchema }),
  items: z.array(copyItemSchema),
  /** Items the target already has exactly as the source does. */
  same: z.number().int().min(0),
});

export const copyPlanSchema = z.object({
  from: environmentRefSchema,
  to: environmentRefSchema,
  applications: z.array(copyApplicationSchema),
  secretMode: copySecretModeSchema,
});

export const copyPlanQuerySchema = z.object({
  from: slugSchema,
  /** Comma-separated application keys; every application when absent. */
  applications: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((key) => key.trim())
            .filter(Boolean)
        : undefined,
    )
    .pipe(z.array(slugSchema).optional()),
});

export const applyCopyBodySchema = z.object({
  from: slugSchema,
  items: z
    .array(z.object({ id: z.string().min(1).max(300), secret: copySecretModeSchema.optional() }))
    .min(1, 'Tick at least one item to copy'),
});

export const copyResultSchema = z.object({
  applied: z.number().int().min(0),
  plan: copyPlanSchema,
});

export type CopySecretMode = z.infer<typeof copySecretModeSchema>;
export type CopySettingNote = z.infer<typeof copySettingNoteSchema>;
export type CopyItem = z.infer<typeof copyItemSchema>;
export type CopyApplication = z.infer<typeof copyApplicationSchema>;
export type CopyPlan = z.infer<typeof copyPlanSchema>;
export type CopyPlanQuery = z.infer<typeof copyPlanQuerySchema>;
export type ApplyCopyBody = z.infer<typeof applyCopyBodySchema>;
export type CopyResult = z.infer<typeof copyResultSchema>;
