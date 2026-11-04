import { z } from 'zod';
import { idSchema, isoDateTimeSchema, personRefSchema } from './common.ts';

/*
 * Roles decide what you see (product rule 7). Four roles, each held by one person for the whole
 * organisation: GET /api/v1/pipelines/me says which one the signed-in person has and the places
 * it shows; Platform › People and roles lists and changes them; approval groups are the named
 * sets of people an environment's approval rule asks, never job titles.
 *
 * Distinct from access.ts's `roleSchema`, the older per-scope binding roles the access engine
 * still evaluates: these four map onto it on the server.
 */

export const ROLES_PATHS = {
  me: '/api/v1/pipelines/me',
  people: '/api/v1/pipelines/people',
  person: (userId: string) => `/api/v1/pipelines/people/${encodeURIComponent(userId)}`,
  invitations: '/api/v1/pipelines/people/invitations',
  invitation: (id: string) => `/api/v1/pipelines/people/invitations/${encodeURIComponent(id)}`,
  groups: '/api/v1/pipelines/approval-groups',
  group: (id: string) => `/api/v1/pipelines/approval-groups/${encodeURIComponent(id)}`,
  groupMembers: (id: string) =>
    `/api/v1/pipelines/approval-groups/${encodeURIComponent(id)}/members`,
  groupMember: (id: string, userId: string) =>
    `/api/v1/pipelines/approval-groups/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
} as const;

export const personRoleSchema = z.enum(['platform_admin', 'developer', 'approver', 'viewer']);

/** The places of the rail a role can be shown; Settings is at the foot for everyone. */
export const placeKeySchema = z.enum([
  'home',
  'services',
  'runs',
  'changes',
  'environments',
  'platform',
]);

/** What each role sees, in rail order. The server sends the same list on /me. */
export const ROLE_PLACES: Readonly<
  Record<z.infer<typeof personRoleSchema>, readonly z.infer<typeof placeKeySchema>[]>
> = {
  platform_admin: ['home', 'services', 'runs', 'changes', 'environments', 'platform'],
  developer: ['home', 'services', 'runs', 'changes'],
  approver: ['home', 'changes'],
  viewer: ['home', 'services', 'runs', 'changes'],
};

/** Pipelines' part of "who am I": the role and the places it shows. */
export const pipelinesMeSchema = z.object({
  user: personRefSchema,
  /** Null until a Platform admin invites the person: they see no place. */
  role: personRoleSchema.nullable(),
  places: z.array(placeKeySchema),
  /** Read only: a Viewer sees screens but no action that changes anything. */
  readOnly: z.boolean(),
});

export const approvalGroupRefSchema = z.object({ id: idSchema, name: z.string() });

export const approvalGroupMemberSchema = z.object({
  user: personRefSchema,
  role: personRoleSchema,
  addedAt: isoDateTimeSchema,
});

export const approvalGroupSchema = approvalGroupRefSchema.extend({
  description: z.string().nullable(),
  members: z.array(approvalGroupMemberSchema),
  /** Environments whose approval rule names this group, so a delete can say what it breaks. */
  usedBy: z.array(z.object({ key: z.string(), name: z.string() })),
  createdAt: isoDateTimeSchema,
});

export const approvalGroupsResponseSchema = z.object({ items: z.array(approvalGroupSchema) });

const groupNameSchema = z.string().trim().min(1, 'Name the group').max(80);

export const createApprovalGroupBodySchema = z.object({
  name: groupNameSchema,
  description: z.string().trim().max(500).optional(),
  members: z.array(idSchema).max(200).default([]),
});

export const updateApprovalGroupBodySchema = z.object({
  name: groupNameSchema.optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export const addGroupMembersBodySchema = z.object({ users: z.array(idSchema).min(1).max(200) });

/** One person in Platform › People and roles. */
export const pipelinesPersonSchema = z.object({
  /** A pending invitation's id stands in for the account it does not have yet. */
  user: personRefSchema,
  email: z.string(),
  role: personRoleSchema,
  groups: z.array(approvalGroupRefSchema),
  /** Environment keys this person may deploy to, from each environment's deployers. */
  deploysTo: z.array(z.string()),
  /** Invited and not signed in yet. */
  pending: z.boolean(),
});

export const peopleResponseSchema = z.object({ items: z.array(pipelinesPersonSchema) });

export const setPersonRoleBodySchema = z.object({ role: personRoleSchema });

export const personParamsSchema = z.object({ userId: idSchema });
export const invitationParamsSchema = z.object({ id: idSchema });
export const approvalGroupParamsSchema = z.object({ id: idSchema });
export const approvalGroupMemberParamsSchema = z.object({ id: idSchema, userId: idSchema });

export const invitePeopleBodySchema = z.object({
  emails: z.array(z.email()).min(1).max(50),
  role: personRoleSchema,
  groups: z.array(idSchema).max(50).default([]),
});

/**
 * People who already have a Bemmoly account get the role at once; the others wait as pending
 * until they accept the workspace invitation the screen sends them (`needAccount`).
 */
export const invitePeopleResponseSchema = z.object({
  items: z.array(pipelinesPersonSchema),
  needAccount: z.array(z.string()),
});

/** The workspace role a new account needs so the Pipelines role can do its work. */
export const WORKSPACE_ROLE_FOR: Readonly<Record<z.infer<typeof personRoleSchema>, string>> = {
  platform_admin: 'member',
  developer: 'member',
  approver: 'member',
  viewer: 'viewer',
};

export type PersonRole = z.infer<typeof personRoleSchema>;
export type PlaceKey = z.infer<typeof placeKeySchema>;
export type PipelinesMe = z.infer<typeof pipelinesMeSchema>;
export type ApprovalGroupRef = z.infer<typeof approvalGroupRefSchema>;
export type ApprovalGroupMember = z.infer<typeof approvalGroupMemberSchema>;
export type ApprovalGroup = z.infer<typeof approvalGroupSchema>;
export type ApprovalGroupsResponse = z.infer<typeof approvalGroupsResponseSchema>;
export type CreateApprovalGroupBody = z.infer<typeof createApprovalGroupBodySchema>;
export type UpdateApprovalGroupBody = z.infer<typeof updateApprovalGroupBodySchema>;
export type AddGroupMembersBody = z.infer<typeof addGroupMembersBodySchema>;
export type PipelinesPerson = z.infer<typeof pipelinesPersonSchema>;
export type PeopleResponse = z.infer<typeof peopleResponseSchema>;
export type SetPersonRoleBody = z.infer<typeof setPersonRoleBodySchema>;
export type InvitePeopleBody = z.infer<typeof invitePeopleBodySchema>;
export type InvitePeopleResponse = z.infer<typeof invitePeopleResponseSchema>;
