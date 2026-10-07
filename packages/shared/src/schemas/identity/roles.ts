import { z } from 'zod';
import { capabilityNameSchema } from '../../capabilities/index.ts';

/** Columns of the roles matrix in the People mock; Org admin always holds every capability. */
export const SYSTEM_ROLE_KEYS = [
  'org_admin',
  'project_admin',
  'member',
  'viewer',
  'contractor',
] as const;

export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const roleSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  userCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const rolesResponseSchema = z.object({ items: z.array(roleSchema) });

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(60),
  /** Start the new role from another role's capability column. */
  copyFromRoleId: z.uuid().optional(),
});

export const updateRoleSchema = z.object({ name: z.string().trim().min(1).max(60) });

export const roleCapabilitySchema = z.object({
  capability: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  group: z.string(),
  moduleId: z.string().nullable(),
  allowed: z.boolean(),
  lockedByOrg: z.boolean(),
});

export const roleCapabilitiesResponseSchema = z.object({
  roleId: z.uuid(),
  items: z.array(roleCapabilitySchema),
});

/** Upserts the listed rows; rows not listed keep their current value. */
export const putRoleCapabilitiesSchema = z.object({
  items: z
    .array(
      z.object({
        capability: capabilityNameSchema,
        allowed: z.boolean(),
        lockedByOrg: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
});

/** The whole matrix in one call: every capability with each role's cell. */
export const capabilityMatrixSchema = z.object({
  roles: z.array(roleSchema),
  items: z.array(
    z.object({
      name: z.string(),
      label: z.string(),
      description: z.string().nullable(),
      group: z.string(),
      moduleId: z.string().nullable(),
      cells: z.record(z.string(), z.object({ allowed: z.boolean(), lockedByOrg: z.boolean() })),
    }),
  ),
});

export type Role = z.infer<typeof roleSchema>;
export type RolesResponse = z.infer<typeof rolesResponseSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type RoleCapability = z.infer<typeof roleCapabilitySchema>;
export type RoleCapabilitiesResponse = z.infer<typeof roleCapabilitiesResponseSchema>;
export type PutRoleCapabilitiesInput = z.infer<typeof putRoleCapabilitiesSchema>;
export type CapabilityMatrix = z.infer<typeof capabilityMatrixSchema>;
