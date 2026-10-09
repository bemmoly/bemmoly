import type { AuditEntry, AuditRecorder } from '../../contracts/audit.ts';
import type { Actor } from '../../contracts/authz.ts';
import type { SqlExecutor } from '../../contracts/sql.ts';
import { redactSecrets } from './record.ts';

function actorUserId(actor: Actor): string | null {
  if (actor.kind === 'user') return actor.id;
  return actor.userId ?? null;
}

const json = (value: unknown) =>
  value === undefined ? null : JSON.stringify(redactSecrets(value));

/**
 * The audit log as modules write it: over the raw pool or a module's own
 * transaction, since modules see postgres.js and never the kernel's Drizzle.
 */
export function createAuditRecorder(sql: SqlExecutor): AuditRecorder {
  return {
    async record(entry: AuditEntry, transaction?: SqlExecutor) {
      const executor = transaction ?? sql;
      await executor`
        insert into audit_log (actor_id, actor_kind, actor_user_id, action, target_kind,
          target_id, before, after, ip, request_id, ai_plan_id)
        values (${entry.actor.id}, ${entry.actor.kind}, ${actorUserId(entry.actor)},
          ${entry.action}, ${entry.target.kind}, ${entry.target.id ?? null},
          ${json(entry.before)}::jsonb, ${json(entry.after)}::jsonb,
          ${entry.meta?.ip ?? null}, ${entry.meta?.requestId ?? null},
          ${entry.aiPlanId ?? null})`;
    },
  };
}
