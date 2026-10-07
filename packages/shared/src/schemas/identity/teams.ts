import { z } from 'zod';

const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour such as #2456c9');

export const teamSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: z.string().nullable(),
  leadUserId: z.uuid().nullable(),
  defaultRoleId: z.uuid().nullable(),
  memberCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const teamsResponseSchema = z.object({ items: z.array(teamSchema) });

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: colorSchema.nullable().optional(),
  leadUserId: z.uuid().nullable().optional(),
  defaultRoleId: z.uuid().nullable().optional(),
});

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field');

export const teamMemberParamsSchema = z.object({ id: z.uuid(), userId: z.uuid() });

export const teamMemberSchema = z.object({
  teamId: z.uuid(),
  userId: z.uuid(),
  createdAt: z.string(),
});

export const teamMembersResponseSchema = z.object({ items: z.array(teamMemberSchema) });

export type Team = z.infer<typeof teamSchema>;
export type TeamsResponse = z.infer<typeof teamsResponseSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type TeamMember = z.infer<typeof teamMemberSchema>;
export type TeamMembersResponse = z.infer<typeof teamMembersResponseSchema>;
