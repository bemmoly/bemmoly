import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';
import { timestampSchema } from '../contracts/common.ts';

/*
 * Approval workflow definitions (ADR 0051): versioned, declarative, owned by a module. A
 * version is ordered stages, each with optional conditions on the request's fields, approver
 * rules, a mode, and an SLA; plus auto-approve groups that skip every stage.
 */

export const CONDITION_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'exists'] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

const fieldValueSchema = z.union([z.string().max(500), z.number(), z.boolean(), z.null()]);

/** Field names are flat keys of the request's fields, such as `amount` or `costCentre`. */
export const fieldNameSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/, 'Field names are letters, digits and underscores');

export const approvalConditionSchema = z.object({
  field: fieldNameSchema,
  op: z.enum(CONDITION_OPERATORS),
  /** Absent for `exists`; a list for `in`. */
  value: z.union([fieldValueSchema, z.array(fieldValueSchema).max(100)]).optional(),
});

export const approverRuleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('user'), userId: z.uuid() }),
  z.object({ type: z.literal('role'), roleKey: z.string().min(1).max(64) }),
  /** 1 is the requester's manager, 2 that manager's manager, and so on. */
  z.object({ type: z.literal('manager'), levels: z.number().int().min(1).max(10).default(1) }),
  z.object({ type: z.literal('cost_centre_owner') }),
]);

export const APPROVAL_STAGE_MODES = ['all', 'any'] as const;

export const approvalStageSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Every condition must hold for the stage to run; otherwise it is skipped. */
  when: z.array(approvalConditionSchema).max(20).default([]),
  approvers: z.array(approverRuleSchema).min(1).max(20),
  /** `all`: every approver must approve; `any`: the first decision decides the stage. */
  mode: z.enum(APPROVAL_STAGE_MODES).default('any'),
  sla: z
    .object({
      hours: z
        .number()
        .positive()
        .max(24 * 90),
      /** Who else is asked once the SLA passes; without it the request is only marked. */
      escalateTo: approverRuleSchema.optional(),
    })
    .optional(),
});

export const workflowSpecSchema = z.object({
  /** Any group whose conditions all hold approves the request with no stage. */
  autoApprove: z.array(z.array(approvalConditionSchema).min(1).max(20)).max(20).default([]),
  stages: z.array(approvalStageSchema).min(1).max(20),
});

export const workflowKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9_-]*)+$/, 'Workflow keys look like "<module>.<name>"')
  .max(120);

/** Saving a definition: creates the workflow on first save, a new version every time. */
export const saveWorkflowBodySchema = z.object({
  moduleId: moduleIdSchema,
  key: workflowKeySchema,
  name: z.string().trim().min(1).max(120),
  spec: workflowSpecSchema,
});

export const approvalWorkflowSchema = z.object({
  id: z.uuid(),
  moduleId: z.string(),
  key: z.string(),
  name: z.string(),
  version: z.number().int().positive(),
  versionId: z.uuid(),
  spec: workflowSpecSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const approvalWorkflowListSchema = z.object({ items: z.array(approvalWorkflowSchema) });

export type ApprovalCondition = z.infer<typeof approvalConditionSchema>;
export type ApproverRule = z.infer<typeof approverRuleSchema>;
export type ApprovalStage = z.infer<typeof approvalStageSchema>;
export type WorkflowSpec = z.infer<typeof workflowSpecSchema>;
export type WorkflowSpecInput = z.input<typeof workflowSpecSchema>;
export type SaveWorkflowBody = z.input<typeof saveWorkflowBodySchema>;
export type ApprovalWorkflow = z.infer<typeof approvalWorkflowSchema>;
