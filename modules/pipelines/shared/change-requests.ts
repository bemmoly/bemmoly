import { z } from 'zod';
import {
  idSchema,
  isoDateTimeSchema,
  keysetPageSchema,
  keysetQuerySchema,
  personRefSchema,
  slugSchema,
} from './common.ts';
import { approvalConditionSchema, deployWindowSchema } from './environments-v2.ts';
import { approvalGroupRefSchema } from './roles.ts';

/*
 * Change requests (product rule 5) move one or more service versions into an environment that
 * has an approval rule. The requester picks the approvers of each step from its group, never
 * themselves; when the last required approval lands the Promote run starts by itself.
 *
 * Not the "What changed?" activity log in changes.ts: that one is `pipeline_changes`.
 */

const base = '/api/v1/pipelines/change-requests';
const one = (number: string) => `${base}/${encodeURIComponent(number)}`;

export const CHANGE_REQUESTS_PATHS = {
  list: base,
  /** By its number, e.g. CHG-1042. */
  request: one,
  send: (number: string) => `${one(number)}/send`,
  approve: (number: string) => `${one(number)}/approve`,
  reject: (number: string) => `${one(number)}/reject`,
  withdraw: (number: string) => `${one(number)}/withdraw`,
  /** What the New change request form offers for an environment: steps, people, versions. */
  options: `${base}/options`,
} as const;

/** "CHG-1042". */
export const changeRequestNumberSchema = z.string().regex(/^CHG-[1-9]\d{0,9}$/, 'Like CHG-1042');

export const changeRiskSchema = z.enum(['low', 'medium', 'high']);

export const changeRequestStatusSchema = z.enum([
  'draft',
  'waiting',
  /** An approver asked for changes: the requester edits it and sends it again. */
  'changes_requested',
  /** Every step approved; the deploy waits for its time or the deploy window. */
  'approved',
  'deploying',
  'deployed',
  /** A deploy it started failed or was rolled back. */
  'failed',
  'rejected',
  'withdrawn',
]);

/** As soon as approved, or at a set time; both only inside the environment's deploy window. */
export const changeWhenSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('asap') }),
  z.object({ kind: z.literal('at'), at: isoDateTimeSchema }),
]);

export const changeRequestItemSchema = z.object({
  application: z.object({ key: slugSchema, name: z.string() }),
  /** Null when nothing runs there yet. */
  fromVersion: z.string().nullable(),
  toVersion: z.string(),
  releaseId: idSchema,
  commitCount: z.number().int().min(0),
});

export const changeApprovalSchema = z.object({
  by: personRefSchema,
  decision: z.enum(['approved', 'rejected', 'changes_requested']),
  note: z.string().nullable(),
  at: isoDateTimeSchema,
});

export const changeRequestStepSchema = z.object({
  position: z.number().int().min(0),
  group: approvalGroupRefSchema,
  count: z.number().int().min(1),
  when: approvalConditionSchema,
  /** The people the requester picked from the group, at least `count` of them. */
  picked: z.array(personRefSchema),
  approvals: z.array(changeApprovalSchema),
  state: z.enum(['queued', 'waiting', 'approved', 'rejected']),
});

/** What backs each version: the runs that built and tested it, its tests and its scan. */
export const changeEvidenceSchema = z.object({
  runs: z.array(
    z.object({
      id: idSchema,
      number: z.number().int(),
      application: slugSchema,
      state: z.string(),
    }),
  ),
  tests: z.array(
    z.object({ application: slugSchema, passed: z.number().int(), failed: z.number().int() }),
  ),
  scans: z.array(
    z.object({ application: slugSchema, state: z.string(), findings: z.number().int() }),
  ),
});

export const changeRequestSchema = z.object({
  id: idSchema,
  number: changeRequestNumberSchema,
  title: z.string(),
  why: z.string(),
  risk: changeRiskSchema,
  when: changeWhenSchema,
  rollback: z.string(),
  environment: z.object({ key: slugSchema, name: z.string() }),
  items: z.array(changeRequestItemSchema),
  steps: z.array(changeRequestStepSchema),
  status: changeRequestStatusSchema,
  evidence: changeEvidenceSchema,
  requestedBy: personRefSchema,
  /** Set when a Platform admin deployed without approval: why, in their words. */
  emergencyReason: z.string().nullable(),
  sentAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/** A row on the Changes list: "1 of 2 approvals". */
export const changeRequestSummarySchema = changeRequestSchema
  .pick({ id: true, number: true, title: true, risk: true, environment: true, status: true })
  .extend({
    requestedBy: personRefSchema,
    serviceCount: z.number().int(),
    /** Each service and the version it moves to, for the list's Versions column. */
    items: z.array(z.object({ application: slugSchema, toVersion: z.string() })),
    approvalsGot: z.number().int(),
    approvalsNeeded: z.number().int(),
    /** Whether the person asking is a picked approver who has not decided yet. */
    waitingForMe: z.boolean(),
    createdAt: isoDateTimeSchema,
  });

export const listChangeRequestsQuerySchema = keysetQuerySchema.extend({
  tab: z.enum(['open', 'mine', 'waiting_for_me', 'decided', 'done', 'all']).default('open'),
  environment: slugSchema.optional(),
});

export const changeRequestsPageSchema = keysetPageSchema(changeRequestSummarySchema);

export const changeRequestDetailSchema = changeRequestSchema.extend({
  activity: z.array(
    z.object({ at: isoDateTimeSchema, by: personRefSchema.nullable(), text: z.string() }),
  ),
  /** The promotions this request started once approved, one per service. */
  deploys: z.array(
    z.object({
      promotionId: idSchema,
      releaseId: idSchema,
      application: slugSchema,
      version: z.string(),
      state: z.string(),
    }),
  ),
  /** The environment's deploy window, so the route can say when the deploy may start. */
  window: deployWindowSchema,
  /** Rule steps left out because their condition did not hold (low or medium risk). */
  skipped: z.array(
    z.object({
      group: approvalGroupRefSchema,
      count: z.number().int(),
      when: approvalConditionSchema,
    }),
  ),
  can: z.object({
    approve: z.boolean(),
    reject: z.boolean(),
    withdraw: z.boolean(),
    send: z.boolean(),
    edit: z.boolean(),
  }),
});

export const createChangeRequestBodySchema = z.object({
  environment: slugSchema,
  title: z.string().trim().min(1, 'Give it a title').max(200),
  why: z.string().trim().min(1, 'Say why').max(5000),
  risk: changeRiskSchema,
  when: changeWhenSchema.default({ kind: 'asap' }),
  rollback: z.string().trim().max(5000).default(''),
  items: z
    .array(z.object({ application: slugSchema, releaseId: idSchema }))
    .min(1, 'Pick at least one version'),
  /** Per step position, the people picked from its group. */
  picks: z.array(z.object({ step: z.number().int().min(0), users: z.array(idSchema).min(1) })),
  /** False saves a draft. */
  send: z.boolean().default(true),
  /**
   * A Platform admin deploying now without approval: the reason is kept on the request and
   * every approver of the environment is told.
   */
  emergency: z
    .object({ reason: z.string().trim().min(10, 'Say why in a sentence').max(2000) })
    .optional(),
});

/** A draft or a request sent back for changes, edited by the person who asked. */
export const updateChangeRequestBodySchema = createChangeRequestBodySchema
  .omit({ environment: true, send: true, emergency: true })
  .partial();

export const approveChangeRequestBodySchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const rejectChangeRequestBodySchema = z.object({
  /** Ask for changes keeps the request open for the requester to edit and send again. */
  kind: z.enum(['reject', 'changes_requested']).default('reject'),
  note: z.string().trim().min(1, 'Say why').max(2000),
});

export const withdrawChangeRequestBodySchema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

export type ChangeRequestNumber = z.infer<typeof changeRequestNumberSchema>;
export type ChangeRisk = z.infer<typeof changeRiskSchema>;
export type ChangeRequestStatus = z.infer<typeof changeRequestStatusSchema>;
export type ChangeWhen = z.infer<typeof changeWhenSchema>;
export type ChangeRequestItem = z.infer<typeof changeRequestItemSchema>;
export type ChangeApproval = z.infer<typeof changeApprovalSchema>;
export type ChangeRequestStep = z.infer<typeof changeRequestStepSchema>;
export type ChangeEvidence = z.infer<typeof changeEvidenceSchema>;
export type ChangeRequest = z.infer<typeof changeRequestSchema>;
export type ChangeRequestSummary = z.infer<typeof changeRequestSummarySchema>;
export type ListChangeRequestsQuery = z.infer<typeof listChangeRequestsQuerySchema>;
export type ChangeRequestsPage = z.infer<typeof changeRequestsPageSchema>;
export type ChangeRequestDetail = z.infer<typeof changeRequestDetailSchema>;
export type CreateChangeRequestBody = z.infer<typeof createChangeRequestBodySchema>;
export type UpdateChangeRequestBody = z.infer<typeof updateChangeRequestBodySchema>;
export type ApproveChangeRequestBody = z.infer<typeof approveChangeRequestBodySchema>;
export type RejectChangeRequestBody = z.infer<typeof rejectChangeRequestBodySchema>;
export type WithdrawChangeRequestBody = z.infer<typeof withdrawChangeRequestBodySchema>;
