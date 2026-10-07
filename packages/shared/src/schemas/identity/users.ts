import { z } from 'zod';
import { workspaceLookSchema } from '../settings/workspace.ts';
import { keysetPageSchema, keysetQuerySchema, personNameSchema } from './common.ts';

export const USER_STATUSES = ['active', 'invited', 'deactivated'] as const;

export const userStatusSchema = z.enum(USER_STATUSES);

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  avatarKey: z.string().nullable(),
  status: userStatusSchema,
  isBreakGlass: z.boolean(),
  roleId: z.uuid(),
  teamIds: z.array(z.uuid()),
  themePref: z.string().nullable(),
  locale: z.string().nullable(),
  timezone: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
  createdAt: z.string(),
});

export const listUsersQuerySchema = keysetQuerySchema.extend({
  status: userStatusSchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

export const usersPageSchema = keysetPageSchema(userSchema);

/** Profile fields anyone may change on themselves; roleId needs workspace.roles.manage. */
export const updateUserSchema = z
  .object({
    name: personNameSchema,
    avatarKey: z.string().trim().min(1).max(200).nullable(),
    themePref: z
      .string()
      .regex(/^[a-z0-9-]{1,40}$/)
      .nullable(),
    locale: z
      .string()
      .regex(/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/)
      .nullable(),
    timezone: z.string().min(1).max(64).nullable(),
    roleId: z.uuid(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field');

export const meResponseSchema = z.object({
  user: userSchema,
  /** Workspace-level capabilities the person holds right now. */
  capabilities: z.array(z.string()),
  /** Enabled modules the person may see. */
  modules: z.array(z.string()),
  /** The workspace's name and look, for everyone signed in. */
  workspace: workspaceLookSchema,
});

export type User = z.infer<typeof userSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UsersPage = z.infer<typeof usersPageSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
