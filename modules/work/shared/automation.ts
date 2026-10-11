import { keysetPageSchema, keysetQuerySchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema } from './common.ts';
import { automationRunStatusSchema } from './enums.ts';
import { lqlQuerySchema } from './filters.ts';

/*
 * A rule is a trigger, conditions and actions. Triggers and actions are named
 * entries of a registry, so the shape is a name plus arguments and the
 * registry validates the arguments; conditions are LQL queries the issue must
 * match, every one of them.
 */

const registryEntrySchema = z.object({
  name: z.string().trim().min(1).max(60),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const automationTriggerSchema = registryEntrySchema;
export const automationActionSchema = registryEntrySchema;

export const automationRuleSchema = z.object({
  id: z.uuid(),
  /** Null for a global rule, which runs in every project. */
  projectId: z.uuid().nullable(),
  name: z.string(),
  enabled: z.boolean(),
  /** Drafted by the AI from a sentence and not yet saved by an admin. */
  isDraft: z.boolean(),
  trigger: automationTriggerSchema,
  conditions: z.array(lqlQuerySchema),
  actions: z.array(automationActionSchema),
  createdBy: z.uuid().nullable(),
  /** The person whose permissions the rule acts with: whoever saved it last. */
  ownerId: z.uuid().nullable(),
  ownerName: z.string().nullable(),
  aiRunId: z.uuid().nullable(),
  lastRunAt: timestampSchema.nullable(),
  lastRunStatus: automationRunStatusSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createAutomationRuleBodySchema = z.object({
  name: nameSchema,
  /** Omitted or null makes a global rule, which only an org admin may. */
  projectId: z.uuid().nullable().optional(),
  enabled: z.boolean().default(false),
  trigger: automationTriggerSchema,
  conditions: z.array(lqlQuerySchema).max(20).default([]),
  actions: z.array(automationActionSchema).min(1, 'Add at least one action').max(20),
});

export const updateAutomationRuleBodySchema = createAutomationRuleBodySchema
  .omit({ projectId: true })
  .partial();

export const listAutomationRulesQuerySchema = z.object({
  /** A project's own rules plus the global ones; omitted lists only global rules. */
  projectId: z.uuid().optional(),
});

/** Why a run was made: an event kind, `schedule`, `workflow` (a post-action) or `test`. */
export const automationRunSchema = z.object({
  id: z.uuid(),
  ruleId: z.uuid(),
  ruleName: z.string(),
  status: automationRunStatusSchema,
  trigger: z.string(),
  issueId: z.uuid().nullable(),
  issueKey: z.string().nullable(),
  /** How many rules in a row led to this run; 0 when a person or a schedule started it. */
  depth: z.number().int().nonnegative(),
  input: z.record(z.string(), z.unknown()),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

/** What a finished run records in `result`. */
export const automationRunResultSchema = z.object({
  conditionsMet: z.boolean(),
  /** Issues a scheduled run acted on; absent for event runs. */
  issueCount: z.number().int().nonnegative().optional(),
  actions: z.array(
    z.object({
      name: z.string(),
      ok: z.boolean(),
      message: z.string(),
      issueKey: z.string().optional(),
    }),
  ),
});

export const listAutomationRunsQuerySchema = keysetQuerySchema.extend({
  status: automationRunStatusSchema.optional(),
  ruleId: z.uuid().optional(),
  /** Runs of the project's rules and of global rules on its issues. */
  projectId: z.uuid().optional(),
});

/** Runs a saved rule now against one issue, so an admin can see what it would do. */
export const createAutomationRunBodySchema = z.object({
  issueKey: z.string().trim().min(1).max(40),
});

export const automationCatalogEntrySchema = z.object({
  name: z.string(),
  label: z.string(),
  description: z.string(),
  /** Arguments as JSON Schema, for the rule builder. */
  params: z.record(z.string(), z.unknown()),
  available: z.boolean(),
});

export const automationCatalogSchema = z.object({
  triggers: z.array(automationCatalogEntrySchema),
  actions: z.array(automationCatalogEntrySchema),
});

export const automationRulesResponseSchema = listSchema(automationRuleSchema);
export const automationRunsPageSchema = keysetPageSchema(automationRunSchema);

export type AutomationTrigger = z.input<typeof automationTriggerSchema>;
export type AutomationAction = z.input<typeof automationActionSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type CreateAutomationRuleBody = z.input<typeof createAutomationRuleBodySchema>;
export type UpdateAutomationRuleBody = z.input<typeof updateAutomationRuleBodySchema>;
export type ListAutomationRulesQuery = z.infer<typeof listAutomationRulesQuerySchema>;
export type AutomationRun = z.infer<typeof automationRunSchema>;
export type AutomationRunResult = z.infer<typeof automationRunResultSchema>;
export type ListAutomationRunsQuery = Partial<z.infer<typeof listAutomationRunsQuerySchema>>;
export type AutomationRunsPage = z.infer<typeof automationRunsPageSchema>;
export type CreateAutomationRunBody = z.infer<typeof createAutomationRunBodySchema>;
export type AutomationCatalogEntry = z.infer<typeof automationCatalogEntrySchema>;
export type AutomationCatalog = z.infer<typeof automationCatalogSchema>;
