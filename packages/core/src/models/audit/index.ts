import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, primaryId } from '../identity/columns.ts';

/**
 * Append-only: a trigger in the changeset rejects UPDATE and DELETE, so the
 * table has no updated_at. The id is UUIDv7, which makes id order time order.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: primaryId(),
    actorId: text('actor_id'),
    actorKind: text('actor_kind', { enum: ['user', 'ai_plan', 'system', 'api_token'] }).notNull(),
    /** The person a token or AI plan acted for. */
    actorUserId: uuid('actor_user_id'),
    action: text('action').notNull(),
    targetKind: text('target_kind').notNull(),
    targetId: text('target_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    requestId: text('request_id'),
    aiPlanId: uuid('ai_plan_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_action_idx').on(t.action, t.id),
    index('audit_log_target_idx').on(t.targetKind, t.targetId, t.id),
    index('audit_log_actor_idx').on(t.actorId, t.id),
    check(
      'audit_log_actor_kind_check',
      sql`${t.actorKind} in ('user', 'ai_plan', 'system', 'api_token')`,
    ),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
