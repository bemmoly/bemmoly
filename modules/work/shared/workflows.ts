import { hexColorSchema, listSchema, timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { nameSchema, shortNameSchema } from './common.ts';
import { statusCategorySchema } from './enums.ts';

/*
 * A workflow is edited as a draft and published as a version. Conditions,
 * validators and post-actions are named entries of the rules registry; the
 * shape here is name plus arguments, the registry validates the arguments.
 */

export const workflowRuleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  args: z.record(z.string(), z.unknown()).default({}),
});

export const transitionRulesSchema = z.object({
  conditions: z.array(workflowRuleSchema).default([]),
  validators: z.array(workflowRuleSchema).default([]),
  postActions: z.array(workflowRuleSchema).default([]),
});

export const workflowStatusSchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  name: z.string(),
  category: statusCategorySchema,
  color: z.string().nullable(),
  position: z.number().int(),
  allowedRoleIds: z.array(z.uuid()),
});

export const workflowTransitionSchema = z.object({
  id: z.uuid(),
  workflowId: z.uuid(),
  /** Null is the "Any" transition. */
  fromStatusId: z.uuid().nullable(),
  toStatusId: z.uuid(),
  name: z.string(),
  rules: transitionRulesSchema,
  position: z.number().int(),
});

export const workflowSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid().nullable(),
  originId: z.uuid().nullable(),
  name: z.string(),
  publishedVersion: z.number().int(),
  hasDraft: z.boolean(),
  statuses: z.array(workflowStatusSchema),
  transitions: z.array(workflowTransitionSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

/** The editor state before publish; ids are the client's until publish assigns real ones. */
export const workflowDraftSchema = z.object({
  statuses: z
    .array(
      z.object({
        id: z.string().min(1),
        name: shortNameSchema,
        category: statusCategorySchema,
        color: hexColorSchema.optional(),
        position: z.number().int().min(0),
        allowedRoleIds: z.array(z.uuid()).default([]),
      }),
    )
    .min(1)
    .max(100),
  transitions: z
    .array(
      z.object({
        id: z.string().min(1),
        fromStatusId: z.string().min(1).nullable(),
        toStatusId: z.string().min(1),
        name: shortNameSchema,
        rules: transitionRulesSchema.prefault({}),
        position: z.number().int().min(0),
      }),
    )
    .max(500),
});

/** A project id makes the new workflow that project's override, copied from the org default. */
export const createWorkflowBodySchema = z.object({
  name: nameSchema,
  projectId: z.uuid().optional(),
});

export const updateWorkflowBodySchema = z.object({ name: nameSchema }).partial();

export const putWorkflowDraftBodySchema = z.object({ draft: workflowDraftSchema });

/** Every problem the editor's Validate panel can show, so it can render each by code. */
export const WORKFLOW_PROBLEM_CODES = [
  'no_done_status',
  'unreachable_status',
  'duplicate_status_name',
  'transition_missing_status',
  'unknown_rule',
  'invalid_rule_params',
] as const;

export const workflowProblemCodeSchema = z.enum(WORKFLOW_PROBLEM_CODES);

/** What validation of a draft reports before publish, keyed to the node or edge it concerns. */
export const workflowProblemSchema = z.object({
  code: workflowProblemCodeSchema,
  message: z.string(),
  statusId: z.string().optional(),
  transitionId: z.string().optional(),
});

export const workflowValidationResponseSchema = z.object({
  valid: z.boolean(),
  problems: z.array(workflowProblemSchema),
});

/**
 * Publishing a draft that drops a status still in use needs to say where
 * those issues go: removed status id to a draft status id.
 */
export const publishWorkflowBodySchema = z.object({
  statusMapping: z.record(z.uuid(), z.string().min(1)).default({}),
});

export const WORKFLOW_RULE_KINDS = ['condition', 'validator', 'post_action'] as const;

export const workflowRuleKindSchema = z.enum(WORKFLOW_RULE_KINDS);

/** One registry entry as the editor's rule picker lists it; params is a JSON Schema. */
export const workflowRuleDefinitionSchema = z.object({
  name: z.string(),
  kind: workflowRuleKindSchema,
  label: z.string(),
  description: z.string(),
  params: z.record(z.string(), z.unknown()),
  /** False while a rule's evaluator is not wired in, so the editor can say so. */
  available: z.boolean(),
});

export const workflowRulesResponseSchema = listSchema(workflowRuleDefinitionSchema);

/** A transition out of an issue's status, with why it is blocked when it is. */
export const availableTransitionSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  toStatusId: z.uuid(),
  toStatusName: z.string(),
  toStatusCategory: statusCategorySchema,
  available: z.boolean(),
  blockedBy: z.array(z.string()),
});

export const issueTransitionsResponseSchema = listSchema(availableTransitionSchema);

export const transitionIssueBodySchema = z.object({
  transitionId: z.uuid(),
  /** Values the transition's validators read, keyed by field key. */
  fields: z.record(z.string(), z.unknown()).default({}),
});

export const workflowsResponseSchema = listSchema(workflowSchema);

export type WorkflowRule = z.infer<typeof workflowRuleSchema>;
export type TransitionRules = z.infer<typeof transitionRulesSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type WorkflowTransition = z.infer<typeof workflowTransitionSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowDraft = z.input<typeof workflowDraftSchema>;
export type CreateWorkflowBody = z.infer<typeof createWorkflowBodySchema>;
export type UpdateWorkflowBody = z.infer<typeof updateWorkflowBodySchema>;
export type PutWorkflowDraftBody = z.input<typeof putWorkflowDraftBodySchema>;
export type WorkflowProblem = z.infer<typeof workflowProblemSchema>;
export type WorkflowProblemCode = z.infer<typeof workflowProblemCodeSchema>;
export type PublishWorkflowBody = z.input<typeof publishWorkflowBodySchema>;
export type WorkflowRuleKind = z.infer<typeof workflowRuleKindSchema>;
export type WorkflowRuleDefinition = z.infer<typeof workflowRuleDefinitionSchema>;
export type WorkflowRulesResponse = z.infer<typeof workflowRulesResponseSchema>;
export type AvailableTransition = z.infer<typeof availableTransitionSchema>;
export type IssueTransitionsResponse = z.infer<typeof issueTransitionsResponseSchema>;
export type WorkflowValidationResponse = z.infer<typeof workflowValidationResponseSchema>;
export type TransitionIssueBody = z.input<typeof transitionIssueBodySchema>;
