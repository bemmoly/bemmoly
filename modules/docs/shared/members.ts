import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';
import { spaceKeySchema } from './common.ts';

/*
 * The people of a space: GET/POST /api/v1/docs/spaces/:spaceKey/members and
 * PUT/DELETE /api/v1/docs/spaces/:spaceKey/members/:userId. A member's role
 * is one of the workspace's roles and replaces their org role inside the
 * space. Org admins can open every space without a membership row, so the
 * list carries them too (access "org_admin"), and canReview is the same
 * rule the reviewers endpoint applies: whoever it marks can be asked to review.
 */

export const SPACE_MEMBER_ACCESS = ['member', 'org_admin'] as const;

export const spaceMemberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  status: z.enum(['active', 'invited', 'deactivated']),
  /** The role inside the space; for an org admin without a row, their org role. */
  roleId: z.uuid(),
  roleKey: z.string(),
  roleName: z.string(),
  access: z.enum(SPACE_MEMBER_ACCESS),
  /** Active and able to open the space's pages: a valid reviewer. */
  canReview: z.boolean(),
  /** When the membership row was made; null for an org admin without one. */
  addedAt: timestampSchema.nullable(),
});

export const spaceRoleSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
});

export const spaceMembersResponseSchema = z.object({
  items: z.array(spaceMemberSchema),
  /** The roles a member can be given, in the roles matrix order. */
  roles: z.array(spaceRoleSchema),
  /** Whether the person asking may add, change and remove members. */
  canManage: z.boolean(),
});

export const addSpaceMembersBodySchema = z
  .object({
    userIds: z.array(z.uuid()).max(100).default([]),
    /** Everyone in these teams joins, as the kernel expands teams when they are added. */
    teamIds: z.array(z.uuid()).max(20).default([]),
    /** Without one, team members take their team's default role and others Member. */
    roleId: z.uuid().optional(),
  })
  .refine((body) => body.userIds.length + body.teamIds.length > 0, {
    message: 'Pick at least one person or team',
    path: ['userIds'],
  });

export const addSpaceMembersResponseSchema = z.object({ items: z.array(spaceMemberSchema) });

/** PUT adds the person with this role, or changes the role of a member. */
export const putSpaceMemberBodySchema = z.object({ roleId: z.uuid() });

export const spaceMemberParamsSchema = z.object({
  spaceKey: z.union([z.uuid(), spaceKeySchema]),
  userId: z.uuid(),
});

/** The role a space's creator gets and a space always keeps one holder of. */
export const SPACE_ADMIN_ROLE_KEY = 'project_admin';

export type SpaceMember = z.infer<typeof spaceMemberSchema>;
export type SpaceMemberAccess = (typeof SPACE_MEMBER_ACCESS)[number];
export type SpaceRole = z.infer<typeof spaceRoleSchema>;
export type SpaceMembersResponse = z.infer<typeof spaceMembersResponseSchema>;
export type AddSpaceMembersBody = z.input<typeof addSpaceMembersBodySchema>;
export type AddSpaceMembersResponse = z.infer<typeof addSpaceMembersResponseSchema>;
export type PutSpaceMemberBody = z.infer<typeof putSpaceMemberBodySchema>;
