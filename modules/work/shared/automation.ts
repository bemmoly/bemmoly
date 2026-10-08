import { keysetPageSchema, keysetQuerySchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema } from './common.ts';
import { automationRunStatusSchema } from './enums.ts';
import { lqlQuerySchema } from './filters.ts';

/*
 * The schema lands now; the engine arrives in a later release. Triggers and
 * actions are named entries of a registry, so the shape is name plus
 * arguments and the registry validates the arguments.
 */

export const automationTriggerSchema = z.union([
  z.object({ kind: z.literal('event'), event: z.string().trim().min(1).max(60) }),
  z.object({ kind: z.literal('schedule'), cron: z.string().trim().min(1).max(100) }),
]);

export const automationActionSchema = z.object({
  name: z.string().trim().min(1).max(60),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const automationRuleSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  name: z.string(),
  enabled: z.boolean(),
  /** Drafted by the AI from a sentence and not yet saved by an admin. */
  isDraft: z.boolean(),
  trigger: automationTriggerSchema,
  conditions: z.array(lqlQuerySchema),
  actions: z.array(automationActionSchema),
  createdBy: z.uuid().nullable(),
  aiRunId: z.uuid().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const createAutomationRuleBodySchema = z.object({
  name: nameSchema,
  enabled: z.boolean().default(false),
  trigger: automationTriggerSchema,
  conditions: z.array(lqlQuerySchema).max(20).default([]),
  actions: z.array(automationActionSchema).min(1).max(20),
});

export const updateAutomationRuleBodySchema = createAutomationRuleBodySchema.partial();

export const automationRunSchema = z.object({
  id: z.uuid(),
  ruleId: z.uuid(),
  status: automationRunStatusSchema,
  input: z.record(z.string(), z.unknown()),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  startedAt: timestampSchema.nullable(),
  finishedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export const listAutomationRunsQuerySchema = keysetQuerySchema.extend({
  status: automationRunStatusSchema.optional(),
});

export const automationRulesResponseSchema = listSchema(automationRuleSchema);
export const automationRunsPageSchema = keysetPageSchema(automationRunSchema);

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type AutomationAction = z.input<typeof automationActionSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type CreateAutomationRuleBody = z.input<typeof createAutomationRuleBodySchema>;
export type UpdateAutomationRuleBody = z.input<typeof updateAutomationRuleBodySchema>;
export type AutomationRun = z.infer<typeof automationRunSchema>;
export type ListAutomationRunsQuery = z.infer<typeof listAutomationRunsQuerySchema>;
export type AutomationRunsPage = z.infer<typeof automationRunsPageSchema>;
