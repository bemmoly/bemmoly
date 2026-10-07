import { z } from 'zod';
import { capabilityNameSchema } from '../../capabilities/index.ts';
import { moduleIdSchema } from '../../modules/index.ts';
import { idSchema, timestampSchema } from './common.ts';

export const roleSchema = z.object({
  id: idSchema,
  key: z.string(),
  name: z.string(),
  isSystem: z.boolean(),
  description: z.string().nullable(),
});

/** The org admin role always holds every capability; its matrix column is read-only. */
export const ORG_ADMIN_ROLE_KEY = 'org_admin';

/** One row of the roles matrix, with the label the People screen shows. */
export const capabilityInfoSchema = z.object({
  name: capabilityNameSchema,
  group: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  module: moduleIdSchema.nullable(),
});

export const roleCapabilitySchema = z.object({
  capability: capabilityNameSchema,
  allowed: z.boolean(),
  /** Locked rows cannot be narrowed or widened at project or space level. */
  lockedByOrg: z.boolean(),
});

export const roleCapabilitiesSchema = z.object({ items: z.array(roleCapabilitySchema) });

export const createRoleRequestSchema = z.object({
  name: z.string().trim().min(1, 'Name the role').max(60),
  copyFromRoleId: idSchema.optional(),
});

export const grantSubjectKindSchema = z.enum(['everyone', 'team', 'role', 'user']);

export const moduleGrantSchema = z.object({
  id: idSchema,
  moduleId: moduleIdSchema,
  subjectKind: grantSubjectKindSchema,
  subjectId: idSchema.nullable(),
  subjectName: z.string().nullable(),
  grantedAt: timestampSchema,
});

export const createModuleGrantRequestSchema = z.object({
  moduleId: moduleIdSchema,
  subjectKind: grantSubjectKindSchema,
  subjectId: idSchema.nullable(),
});

export const moduleStateSchema = z.enum(['enabled', 'disabled']);

/** Settings › Modules: every module in the image, enabled or not. */
export const adminModuleSchema = z.object({
  id: moduleIdSchema,
  name: z.string(),
  description: z.string(),
  version: z.string(),
  state: moduleStateSchema,
  dataSizeBytes: z.number().int().nonnegative().nullable(),
  changelog: z.object({
    applied: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    status: z.enum(['current', 'pending', 'failed']),
  }),
  hasData: z.boolean(),
  /** BEMMOLY_MODULES pins the set; the page is read-only then. */
  pinnedByEnv: z.boolean(),
  dependsOn: z.array(moduleIdSchema),
});

export const removeModuleDataRequestSchema = z.object({ confirm: moduleIdSchema });

export type Role = z.infer<typeof roleSchema>;
export type CapabilityInfo = z.infer<typeof capabilityInfoSchema>;
export type RoleCapability = z.infer<typeof roleCapabilitySchema>;
export type CreateRoleRequest = z.infer<typeof createRoleRequestSchema>;
export type GrantSubjectKind = z.infer<typeof grantSubjectKindSchema>;
export type ModuleGrant = z.infer<typeof moduleGrantSchema>;
export type CreateModuleGrantRequest = z.infer<typeof createModuleGrantRequestSchema>;
export type ModuleState = z.infer<typeof moduleStateSchema>;
export type AdminModule = z.infer<typeof adminModuleSchema>;
