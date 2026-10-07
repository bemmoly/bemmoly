import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';
import { idSchema, pageQuerySchema, pageSchema, refSchema, timestampSchema } from './common.ts';

export const userStatusSchema = z.enum(['active', 'invited', 'deactivated']);

export const roleRefSchema = z.object({ id: idSchema, key: z.string(), name: z.string() });

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  status: userStatusSchema,
  role: roleRefSchema,
  teams: z.array(refSchema),
  /** Human label for the sign-in method, e.g. "Password" or "Google SSO". */
  authMethod: z.string(),
  lastActiveAt: timestampSchema.nullable(),
  /** Modules this person can open, resolved from module grants. */
  modules: z.array(moduleIdSchema),
});

export const usersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().min(1).optional(),
  roleId: idSchema.optional(),
  teamId: idSchema.optional(),
  status: userStatusSchema.optional(),
});

export const usersPageSchema = pageSchema(userSchema).extend({
  counts: z.object({
    active: z.number().int().nonnegative(),
    invited: z.number().int().nonnegative(),
    deactivated: z.number().int().nonnegative(),
  }),
});

export const updateUserRequestSchema = z.object({
  roleId: idSchema.optional(),
  status: z.enum(['active', 'deactivated']).optional(),
});

export const invitationSchema = z.object({
  id: idSchema,
  email: z.email(),
  role: roleRefSchema,
  team: refSchema.nullable(),
  expiresAt: timestampSchema,
  createdAt: timestampSchema,
});

export const createInvitationsRequestSchema = z.object({
  emails: z.array(z.email()).min(1, 'Add at least one email address').max(200),
  roleId: idSchema,
  teamId: idSchema.optional(),
});

export const createInvitationsResponseSchema = z.object({ items: z.array(invitationSchema) });

export const teamSchema = z.object({
  id: idSchema,
  name: z.string(),
  lead: refSchema.nullable(),
  memberCount: z.number().int().nonnegative(),
  /** The first few members, for the avatar stack. */
  members: z.array(refSchema),
  defaultRole: roleRefSchema,
});

export const createTeamRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name the team').max(80),
  leadUserId: idSchema.optional(),
  defaultRoleId: idSchema,
});

export type UserStatus = z.infer<typeof userStatusSchema>;
export type RoleRef = z.infer<typeof roleRefSchema>;
export type User = z.infer<typeof userSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>;
export type UsersPage = z.infer<typeof usersPageSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type Invitation = z.infer<typeof invitationSchema>;
export type CreateInvitationsRequest = z.infer<typeof createInvitationsRequestSchema>;
export type Team = z.infer<typeof teamSchema>;
export type CreateTeamRequest = z.infer<typeof createTeamRequestSchema>;
