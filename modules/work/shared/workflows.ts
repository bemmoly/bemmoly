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

export const createWorkflowBodySchema = z.object({ name: nameSchema });

export const updateWorkflowBodySchema = z.object({ name: nameSchema }).partial();

export const putWorkflowDraftBodySchema = z.object({ draft: workflowDraftSchema });

/** What validation of a draft reports before publish, keyed to the node or edge it concerns. */
export const workflowProblemSchema = z.object({
  code: z.string(),
  message: z.string(),
  statusId: z.string().optional(),
  transitionId: z.string().optional(),
});

export const workflowValidationResponseSchema = z.object({
  valid: z.boolean(),
  problems: z.array(workflowProblemSchema),
});

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
export type WorkflowValidationResponse = z.infer<typeof workflowValidationResponseSchema>;
export type TransitionIssueBody = z.input<typeof transitionIssueBodySchema>;
