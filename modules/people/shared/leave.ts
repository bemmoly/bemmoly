import { z } from 'zod';
import { dateSchema, nameSchema, queryFlagSchema } from './common.ts';

/*
 * Time off: policies per location, balances worked out from requests, and requests that run
 * through the kernel's approval engine with the "manager of requester" rule.
 */

export const LEAVE_KINDS = ['annual', 'sick', 'parental', 'unpaid', 'other'] as const;
export const leaveKindSchema = z.enum(LEAVE_KINDS);
export type LeaveKind = z.infer<typeof leaveKindSchema>;

export const leavePolicySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: leaveKindSchema,
  /** Null applies everywhere; a location's own policy of the same kind wins over it. */
  locationId: z.uuid().nullable(),
  /** Days a year; null is no fixed limit. */
  allowanceDays: z.number().nullable(),
  carryOverDays: z.number(),
  /** Whether a request waits for the manager; when false it is booked at once. */
  needsApproval: z.boolean(),
  archived: z.boolean(),
});

const days = z.number().min(0).max(366).multipleOf(0.5);

export const createLeavePolicyBodySchema = z.object({
  name: nameSchema,
  kind: leaveKindSchema,
  locationId: z.uuid().nullish(),
  allowanceDays: days.nullish(),
  carryOverDays: days.default(0),
  needsApproval: z.boolean().default(true),
});

export const updateLeavePolicyBodySchema = z.object({
  name: nameSchema.optional(),
  allowanceDays: days.nullish(),
  carryOverDays: days.optional(),
  needsApproval: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const leavePoliciesResponseSchema = z.object({ items: z.array(leavePolicySchema) });

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const;
export const leaveStatusSchema = z.enum(LEAVE_STATUSES);
export type LeaveStatus = z.infer<typeof leaveStatusSchema>;

export const leaveRequestSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  policyId: z.uuid(),
  kind: leaveKindSchema,
  startDate: dateSchema,
  endDate: dateSchema,
  halfDay: z.boolean(),
  days: z.number(),
  note: z.string().nullable(),
  status: leaveStatusSchema,
  approvalRequestId: z.uuid().nullable(),
  createdAt: z.string(),
});

export const createLeaveRequestBodySchema = z
  .object({
    policyId: z.uuid(),
    startDate: dateSchema,
    endDate: dateSchema,
    halfDay: z.boolean().default(false),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((body) => body.startDate <= body.endDate, {
    message: 'The last day is before the first',
    path: ['endDate'],
  });

export const LEAVE_SCOPES = ['mine', 'team', 'all'] as const;

export const listLeaveRequestsQuerySchema = z.object({
  /** Mine; my reports'; or everyone's, for those who manage leave. */
  scope: z.enum(LEAVE_SCOPES).default('mine'),
  status: leaveStatusSchema.optional(),
  upcoming: queryFlagSchema.optional(),
});

export const leaveRequestsResponseSchema = z.object({ items: z.array(leaveRequestSchema) });

export const leaveBalanceSchema = z.object({
  policyId: z.uuid(),
  name: z.string(),
  kind: leaveKindSchema,
  year: z.number().int(),
  /** Null when the policy has no fixed limit. */
  allowance: z.number().nullable(),
  used: z.number(),
  booked: z.number(),
  pending: z.number(),
  left: z.number().nullable(),
});

export const balancesQuerySchema = z.object({
  userId: z.uuid().optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const leaveBalancesResponseSchema = z.object({ items: z.array(leaveBalanceSchema) });

/**
 * One person away on the team calendar. The kind is shown only to the person, their
 * managers and people who manage leave; everyone else sees that they are away.
 */
export const absenceSchema = z.object({
  requestId: z.uuid(),
  userId: z.uuid(),
  startDate: dateSchema,
  endDate: dateSchema,
  halfDay: z.boolean(),
  status: z.enum(['pending', 'approved']),
  kind: leaveKindSchema.nullable(),
});

export const absencesQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    teamId: z.uuid().optional(),
  })
  .refine((query) => query.from <= query.to, { message: 'from is after to', path: ['to'] });

export const absencesResponseSchema = z.object({ items: z.array(absenceSchema) });

export type LeavePolicy = z.infer<typeof leavePolicySchema>;
export type CreateLeavePolicyBody = z.input<typeof createLeavePolicyBodySchema>;
export type UpdateLeavePolicyBody = z.input<typeof updateLeavePolicyBodySchema>;
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;
export type CreateLeaveRequestBody = z.input<typeof createLeaveRequestBodySchema>;
export type ListLeaveRequestsQuery = z.input<typeof listLeaveRequestsQuerySchema>;
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;
export type BalancesQuery = z.infer<typeof balancesQuerySchema>;
export type Absence = z.infer<typeof absenceSchema>;
export type AbsencesQuery = z.input<typeof absencesQuerySchema>;
