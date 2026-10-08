import type { Database } from '../../clients/drizzle.ts';
import { recordAudit, type AuditEntryInput } from './record.ts';

export { createAuditActivity, type AuditActivityCounter } from './activity.ts';
export { auditCsvHeader, auditCsvRow, auditLogToCsv, csvCell } from './csv.ts';
export { exportAuditLog } from './export.ts';
export { EXPORT_MAX_ROWS, iterateAuditLog, listAuditLog, presentAuditEntry } from './list.ts';
export { recordAudit, redactSecrets, type AuditEntryInput, type RequestMeta } from './record.ts';
export { createAuditRecorder } from './recorder.ts';

export interface AuditService {
  /** Pass the mutation's transaction as `db` so both commit together. */
  record(entry: AuditEntryInput, db?: Database): Promise<void>;
}

/** The facade other kernel services and modules use: `audit.record({...})`. */
export function createAuditService(db: Database): AuditService {
  return { record: (entry, executor) => recordAudit(executor ?? db, entry) };
}
