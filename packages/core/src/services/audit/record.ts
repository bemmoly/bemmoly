import type { Database } from '../../clients/drizzle.ts';
import type { Actor } from '../../contracts/authz.ts';
import { auditLog } from '../../models/audit/index.ts';

/** Where a mutation came from, for the audit row. */
export interface RequestMeta {
  ip?: string;
  requestId?: string;
}

export interface AuditEntryInput {
  actor: Actor;
  /** Dotted verb such as `user.deactivated` or `role.capabilities_changed`. */
  action: string;
  target: { kind: string; id?: string | null };
  before?: unknown;
  after?: unknown;
  meta?: RequestMeta;
  aiPlanId?: string;
}

const SECRET_KEY = /password|secret|token_?hash|^token$|credential/i;

/** Defence in depth: services pass presented objects, but never let a secret reach the log. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEY.test(key))
        .map(([key, inner]) => [key, redactSecrets(inner)]),
    );
  }
  return value;
}

function actorUserId(actor: Actor): string | null {
  if (actor.kind === 'user') return actor.id;
  return actor.userId ?? null;
}

/**
 * Writes one audit row. Pass the transaction that performs the mutation so the
 * change and its audit row commit or roll back together.
 */
export async function recordAudit(db: Database, entry: AuditEntryInput): Promise<void> {
  await db.insert(auditLog).values({
    actorId: entry.actor.id,
    actorKind: entry.actor.kind,
    actorUserId: actorUserId(entry.actor),
    action: entry.action,
    targetKind: entry.target.kind,
    targetId: entry.target.id ?? null,
    before: entry.before === undefined ? null : redactSecrets(entry.before),
    after: entry.after === undefined ? null : redactSecrets(entry.after),
    ip: entry.meta?.ip ?? null,
    requestId: entry.meta?.requestId ?? null,
    aiPlanId: entry.aiPlanId ?? null,
  });
}
