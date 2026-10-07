import { z } from 'zod';
import { moduleIdSchema } from '../../modules/index.ts';

export const MODULE_GRANT_SUBJECT_KINDS = ['everyone', 'team', 'role', 'user'] as const;

export const moduleGrantSubjectKindSchema = z.enum(MODULE_GRANT_SUBJECT_KINDS);

export const moduleGrantSchema = z.object({
  id: z.uuid(),
  moduleId: z.string(),
  subjectKind: moduleGrantSubjectKindSchema,
  subjectId: z.uuid().nullable(),
  grantedBy: z.uuid().nullable(),
  createdAt: z.string(),
});

export const moduleGrantsResponseSchema = z.object({ items: z.array(moduleGrantSchema) });

export const listModuleGrantsQuerySchema = z.object({ moduleId: moduleIdSchema.optional() });

export const createModuleGrantSchema = z
  .object({
    moduleId: moduleIdSchema,
    subjectKind: moduleGrantSubjectKindSchema,
    subjectId: z.uuid().optional(),
  })
  .refine((grant) => (grant.subjectKind === 'everyone') === (grant.subjectId === undefined), {
    message: 'subjectId is required for team, role and user grants and not allowed for everyone',
    path: ['subjectId'],
  });

export type ModuleGrantSubjectKind = z.infer<typeof moduleGrantSubjectKindSchema>;
export type ModuleGrant = z.infer<typeof moduleGrantSchema>;
export type ModuleGrantsResponse = z.infer<typeof moduleGrantsResponseSchema>;
export type ListModuleGrantsQuery = z.infer<typeof listModuleGrantsQuerySchema>;
export type CreateModuleGrantInput = z.infer<typeof createModuleGrantSchema>;
