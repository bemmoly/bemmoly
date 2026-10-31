import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';
import { timestampSchema } from '../contracts/common.ts';
import { keysetPageSchema, keysetQuerySchema } from '../identity/common.ts';
import { workflowKeySchema } from './definitions.ts';

/*
 * Approval requests at run time (ADR 0051): owned by a module and a subject, with one task per
 * approver per stage. `escalated` is still open: an SLA passed and more people were asked.
 */

export const APPROVAL_STATUSES = [
  'pending',
  'escalated',
  'approved',
  'rejected',
  'withdrawn',
] as const;
export const OPEN_APPROVAL_STATUSES = ['pending', 'escalated'] as const;
export const APPROVAL_TASK_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;
export const APPROVAL_DECISIONS = ['approve', 'reject'] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export type ApprovalTaskStatus = (typeof APPROVAL_TASK_STATUSES)[number];
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const approvalSubjectSchema = z.object({
  kind: z.string().min(1).max(64),
  id: z.string().min(1).max(200),
});

/** Field values a workflow's conditions read; frozen when the request starts. */
export const approvalFieldsSchema = z
  .record(z.string().max(64), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
  .refine((fields) => Object.keys(fields).length <= 50, 'At most 50 fields');

/** What a module passes to start a request; the actor is the requester. */
export const startApprovalInputSchema = z.object({
  moduleId: moduleIdSchema,
  workflowKey: workflowKeySchema,
  subject: approvalSubjectSchema,
  title: z.string().trim().min(1).max(200),
  fields: approvalFieldsSchema.default({}),
  /** App-relative link to the subject, for notifications. */
  url: z.string().max(2000).optional(),
});

export const decideApprovalBodySchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  comment: z.string().trim().max(2000).optional(),
});

export const withdrawApprovalBodySchema = z.object({
  comment: z.string().trim().max(2000).optional(),
});

export const listApprovalsQuerySchema = keysetQuerySchema.extend({
  /** `waiting`: open tasks of the caller; `mine`: requests the caller started. */
  scope: z.enum(['waiting', 'mine']).default('waiting'),
  moduleId: moduleIdSchema.optional(),
});

export const approvalTaskSchema = z.object({
  id: z.uuid(),
  stage: z.number().int().nonnegative(),
  approverId: z.uuid(),
  /** Set when the task went to a delegate: the person it was for. */
  onBehalfOf: z.uuid().nullable(),
  status: z.enum(APPROVAL_TASK_STATUSES),
  escalation: z.boolean(),
  comment: z.string().nullable(),
  dueAt: timestampSchema.nullable(),
  decidedAt: timestampSchema.nullable(),
});

export const approvalRequestSchema = z.object({
  id: z.uuid(),
  moduleId: z.string(),
  workflowKey: z.string(),
  workflowVersion: z.number().int().positive(),
  subject: approvalSubjectSchema,
  title: z.string(),
  url: z.string().nullable(),
  requesterId: z.uuid(),
  fields: z.record(z.string(), z.unknown()),
  status: z.enum(APPROVAL_STATUSES),
  /** Index into the version's stages; null once the request is closed. */
  currentStage: z.number().int().nonnegative().nullable(),
  autoApproved: z.boolean(),
  tasks: z.array(approvalTaskSchema),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  closedAt: timestampSchema.nullable(),
});

export const approvalRequestPageSchema = keysetPageSchema(approvalRequestSchema);

export const delegationBodySchema = z
  .object({
    delegateId: z.uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((body) => body.endsAt > body.startsAt, {
    message: 'The end comes after the start',
    path: ['endsAt'],
  });

export const approvalDelegationSchema = z.object({
  delegateId: z.uuid(),
  startsAt: timestampSchema,
  endsAt: timestampSchema,
});

export const approvalDelegationResponseSchema = z.object({
  delegation: approvalDelegationSchema.nullable(),
});

export type ApprovalSubject = z.infer<typeof approvalSubjectSchema>;
export type ApprovalFields = z.infer<typeof approvalFieldsSchema>;
export type StartApprovalInput = z.input<typeof startApprovalInputSchema>;
export type DecideApprovalBody = z.input<typeof decideApprovalBodySchema>;
export type WithdrawApprovalBody = z.input<typeof withdrawApprovalBodySchema>;
export type ListApprovalsQuery = Partial<z.infer<typeof listApprovalsQuerySchema>>;
export type ApprovalTask = z.infer<typeof approvalTaskSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalRequestPage = z.infer<typeof approvalRequestPageSchema>;
export type DelegationBody = z.input<typeof delegationBodySchema>;
export type ApprovalDelegation = z.infer<typeof approvalDelegationSchema>;
