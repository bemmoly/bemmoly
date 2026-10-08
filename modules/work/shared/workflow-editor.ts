import { z } from 'zod';

/*
 * What the visual workflow editor needs beyond the workflow itself: the rules
 * catalog it picks conditions, validators and post-actions from, the issue
 * counts the canvas shows per status, and the publish body that maps issues
 * off statuses the draft removed.
 */

export const RULE_KINDS = ['condition', 'validator', 'post'] as const;
export const ruleKindSchema = z.enum(RULE_KINDS);
export type RuleKind = z.infer<typeof ruleKindSchema>;

/** The form control the editor draws for one rule argument. */
export const RULE_PARAM_TYPES = ['text', 'number', 'field', 'role', 'select', 'user'] as const;
export const ruleParamTypeSchema = z.enum(RULE_PARAM_TYPES);

export const ruleParamSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: ruleParamTypeSchema,
  required: z.boolean().default(false),
  /** Fixed choices for "select". */
  options: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
});

export const ruleCatalogEntrySchema = z.object({
  /** The registry name stored in a transition's rules: "pr_linked". */
  name: z.string(),
  kind: ruleKindSchema,
  label: z.string(),
  description: z.string(),
  params: z.array(ruleParamSchema).default([]),
});

export const ruleCatalogResponseSchema = z.object({ items: z.array(ruleCatalogEntrySchema) });

/** Issues per status id, for the "· 42 issues" line on each canvas node. */
export const workflowStatusCountsSchema = z.object({
  counts: z.record(z.string(), z.number().int().nonnegative()),
});

/** Publish moves issues off statuses the draft removed; every removed status needs a target. */
export const publishWorkflowBodySchema = z.object({
  statusMapping: z.record(z.string(), z.string().min(1)).default({}),
});

export type RuleParam = z.infer<typeof ruleParamSchema>;
export type RuleCatalogEntry = z.infer<typeof ruleCatalogEntrySchema>;
export type RuleCatalogResponse = z.infer<typeof ruleCatalogResponseSchema>;
export type WorkflowStatusCounts = z.infer<typeof workflowStatusCountsSchema>;
export type PublishWorkflowBody = z.input<typeof publishWorkflowBodySchema>;
