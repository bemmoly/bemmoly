import {
  applyUpdateRequestSchema,
  auditPageSchema,
  auditQuerySchema,
  backupSchema,
  backupsPageSchema,
  restoreBackupRequestSchema,
  systemStatusSchema,
  updateStatusSchema,
  type AuditQuery,
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
      list: async (query: AuditQuery = {}) =>
        http.request('/api/v1/audit-log', auditPageSchema, {
          query: validated(auditQuerySchema, query),
        }),
      exportUrl: (query: AuditQuery = {}) => {
        const filters = validated(auditQuerySchema, query);
        return http.url('/api/v1/audit-log/export', {
          actorId: filters.actorId,
          action: filters.action,
          targetKind: filters.targetKind,
          from: filters.from,
          to: filters.to,
          format: 'csv',
        });
      },
    },
  };
}
