import {
  applyUpdateRequestSchema,
  auditLogPageSchema,
  listAuditLogQuerySchema,
  backupSchema,
  backupsPageSchema,
  restoreBackupRequestSchema,
  systemStatusSchema,
  updateStatusSchema,
  type ListAuditLogQuery,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export function operationsEndpoints(http: Http) {
  return {
    backups: {
      list: async (cursor?: string) =>
        http.request('/api/v1/admin/backups', backupsPageSchema, { query: { cursor } }),
      run: async () =>
        http.request('/api/v1/admin/backups', backupSchema, { method: 'POST', idempotent: true }),
      restore: async (id: string) =>
        http.send(`/api/v1/admin/backups/${enc(id)}/restore`, {
          method: 'POST',
          body: validated(restoreBackupRequestSchema, { confirm: id }),
        }),
      /** The restore drill: a test restore into a temporary database with row counts. */
      verify: async (id: string) =>
        http.request(`/api/v1/admin/backups/${enc(id)}/verify`, backupSchema, { method: 'POST' }),
      downloadUrl: (id: string) => http.url(`/api/v1/admin/backups/${enc(id)}/download`),
    },
    updates: {
      status: async () => http.request('/api/v1/admin/updates', updateStatusSchema),
      check: async () =>
        http.request('/api/v1/admin/updates/check', updateStatusSchema, { method: 'POST' }),
      apply: async (version: string) =>
        http.request('/api/v1/admin/updates/apply', updateStatusSchema, {
          method: 'POST',
          body: validated(applyUpdateRequestSchema, { version }),
        }),
      rollback: async () =>
        http.request('/api/v1/admin/updates/rollback', updateStatusSchema, { method: 'POST' }),
    },
    system: {
      status: async () => http.request('/api/v1/admin/system', systemStatusSchema),
    },
    audit: {
      list: async (query: AuditFilter = {}) =>
        http.request('/api/v1/audit-log', auditLogPageSchema, {
          query: validated(listAuditLogQuerySchema, { ...query, format: 'json' }),
        }),
      /** The same endpoint with format=csv, for a download link; no paging. */
      exportUrl: (query: AuditFilter = {}) =>
        http.url('/api/v1/audit-log', {
          action: query.action,
          actorId: query.actorId,
          targetKind: query.targetKind,
          targetId: query.targetId,
          since: query.since,
          until: query.until,
          format: 'csv',
        }),
    },
  };
}

export type AuditFilter = Partial<Omit<ListAuditLogQuery, 'format'>>;
