import { timestampSchema } from '@bemmoly/shared';
import { z } from 'zod';

/*
 * The people of a project and the role each holds inside it. The role is one
 * of the workspace's roles; inside the project it replaces the person's org
 * role when capabilities are resolved, so a Viewer can be a project's admin.
 */

export const projectMemberSchema = z.object({
  userId: z.uuid(),
  name: z.string(),
  email: z.string(),
  status: z.enum(['active', 'invited', 'deactivated']),
  roleId: z.uuid(),
  roleKey: z.string(),
  roleName: z.string(),
  addedAt: timestampSchema,
});

export const projectRoleSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
});

export const projectMembersResponseSchema = z.object({
  items: z.array(projectMemberSchema),
  /** The roles a member can be given, in the roles matrix order. */
  roles: z.array(projectRoleSchema),
  /** Whether the person asking may add, change and remove members. */
  canManage: z.boolean(),
});

export const addProjectMembersBodySchema = z
  .object({
    userIds: z.array(z.uuid()).max(100).default([]),
    /** Everyone in these teams joins. */
    teamIds: z.array(z.uuid()).max(20).default([]),
    /** Without one, team members take their team's default role and others Member. */
    roleId: z.uuid().optional(),
  })
  .refine((body) => body.userIds.length + body.teamIds.length > 0, {
    message: 'Pick at least one person or team',
    path: ['userIds'],
  });

export const addProjectMembersResponseSchema = z.object({ items: z.array(projectMemberSchema) });

export const updateProjectMemberBodySchema = z.object({ roleId: z.uuid() });

export const projectMemberParamsSchema = z.object({
  key: z.string().trim().min(1).max(64),
  userId: z.uuid(),
});

/** The role key that may change members; a project always keeps one. */
export const PROJECT_ADMIN_ROLE_KEY = 'project_admin';

export type ProjectMember = z.infer<typeof projectMemberSchema>;
export type ProjectRole = z.infer<typeof projectRoleSchema>;
export type ProjectMembersResponse = z.infer<typeof projectMembersResponseSchema>;
export type AddProjectMembersBody = z.input<typeof addProjectMembersBodySchema>;
export type AddProjectMembersResponse = z.infer<typeof addProjectMembersResponseSchema>;
export type UpdateProjectMemberBody = z.infer<typeof updateProjectMemberBodySchema>;
