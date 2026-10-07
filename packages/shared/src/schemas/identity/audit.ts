import { z } from 'zod';
import { keysetPageSchema, keysetQuerySchema } from './common.ts';

export const AUDIT_ACTOR_KINDS = ['user', 'ai_plan', 'system', 'api_token'] as const;

export const auditActorKindSchema = z.enum(AUDIT_ACTOR_KINDS);

export const auditEntrySchema = z.object({
  id: z.uuid(),
  actorId: z.string().nullable(),
  actorKind: auditActorKindSchema,
  /** The person a token or AI plan acted for. */
  actorUserId: z.uuid().nullable(),
  action: z.string(),
  targetKind: z.string(),
  targetId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  requestId: z.string().nullable(),
  aiPlanId: z.uuid().nullable(),
  createdAt: z.string(),
});

export const listAuditLogQuerySchema = keysetQuerySchema.extend({
  action: z.string().min(1).max(100).optional(),
  actorId: z.string().min(1).max(100).optional(),
  targetKind: z.string().min(1).max(100).optional(),
  targetId: z.string().min(1).max(100).optional(),
  since: z.iso.datetime({ offset: true }).optional(),
  until: z.iso.datetime({ offset: true }).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

export const auditLogPageSchema = keysetPageSchema(auditEntrySchema);

export type AuditActorKind = z.infer<typeof auditActorKindSchema>;
export type AuditEntry = z.infer<typeof auditEntrySchema>;
export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
export type AuditLogPage = z.infer<typeof auditLogPageSchema>;
