import {
  auditLogPageSchema,
  backupListResponseSchema,
  backupSchema,
  listAuditLogQuerySchema,
  verifyBackupRequestSchema,
  type BackupKind,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import type { AuditFilter } from './operations.ts';
import { enc, validated } from './validate.ts';

export interface BackupsFilter {
  cursor?: string;
  limit?: number;
  kind?: BackupKind;
}

/**
 * Settings › Backups and Settings › Audit log, gated by workspace.system.manage and
 * workspace.audit.view. Their own entry (`@bemmoly/api-client/operations-admin`), bound to a
 * client's `http`, so their schemas load with those screens and not with the shell.
 */
export function operationsAdminEndpoints(http: Http) {
  return {
    backups: {
      list: async (filter: BackupsFilter = {}) =>
        http.request('/api/v1/admin/backups', backupListResponseSchema, {
          query: { cursor: filter.cursor, limit: filter.limit, kind: filter.kind },
        }),
      get: async (id: string) => http.request(`/api/v1/admin/backups/${enc(id)}`, backupSchema),
      run: async () =>
        http.request('/api/v1/admin/backups', backupSchema, {
          method: 'POST',
          body: {},
          idempotent: true,
        }),
      /** 202: the server enters maintenance and restores; the page shows the banner. */
      restore: async (id: string) =>
        http.send(`/api/v1/admin/backups/${enc(id)}/restore`, {
          method: 'POST',
          body: { confirm: true },
        }),
      /** `list` checks the archive; `restore` is the full restore drill. */
      verify: async (id: string, depth: 'list' | 'restore' = 'restore') =>
        http.send(`/api/v1/admin/backups/${enc(id)}/verify`, {
          method: 'POST',
          body: validated(verifyBackupRequestSchema, { depth }),
        }),
      downloadUrl: (id: string) => http.url(`/api/v1/admin/backups/${enc(id)}/download`),
    },
    audit: {
      list: async (query: AuditFilter = {}) =>
        http.request('/api/v1/audit-log', auditLogPageSchema, {
          query: validated(listAuditLogQuerySchema, { ...query, format: 'json' }),
        }),
    },
  };
}
