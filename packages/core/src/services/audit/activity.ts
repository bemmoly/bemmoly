import { count, countDistinct, gt } from 'drizzle-orm';
import type { Database } from '../../clients/drizzle.ts';
import { auditLog } from '../../models/audit/index.ts';

export interface AuditActivityCounter {
  /** Audit rows written after `since`, and how many people wrote them. */
  countSince(since: Date): Promise<{ changes: number; people: number }>;
}

/** What a restore would discard, for the rollback dialog's summary. */
export function createAuditActivity(db: Database): AuditActivityCounter {
  return {
    async countSince(since) {
      const [row] = await db
        .select({ changes: count(), people: countDistinct(auditLog.actorUserId) })
        .from(auditLog)
        .where(gt(auditLog.createdAt, since));
      return { changes: row?.changes ?? 0, people: row?.people ?? 0 };
    },
  };
}
