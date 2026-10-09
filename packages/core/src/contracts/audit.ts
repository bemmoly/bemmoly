import type { Actor } from './authz.ts';
import type { SqlExecutor } from './sql.ts';

/** Where a mutation came from, for its audit row. */
export interface AuditMeta {
  ip?: string;
  requestId?: string;
}

export interface AuditEntry {
  actor: Actor;
  /** Dotted verb such as `user.deactivated` or `project.created`. */
  action: string;
  target: { kind: string; id?: string | null };
  before?: unknown;
  after?: unknown;
  meta?: AuditMeta;
  aiPlanId?: string;
}

/**
 * Writes rows of the kernel's audit log. Modules receive one so their
 * mutations are audited the way kernel settings are; pass the mutation's
 * transaction so the change and its row commit or roll back together.
 */
export interface AuditRecorder {
  record(entry: AuditEntry, transaction?: SqlExecutor): Promise<void>;
}
