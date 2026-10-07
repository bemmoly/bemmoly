import {
  applyUpdateRequestSchema,
  auditLogPageSchema,
  backupListResponseSchema,
  backupSchema,
  catalogUploadResponseSchema,
  listAuditLogQuerySchema,
  rollbackRequestSchema,
  systemHealthResponseSchema,
  updaterAcceptedSchema,
  updatesOverviewSchema,
  verifyBackupRequestSchema,
  type BackupKind,
  type ListAuditLogQuery,
  type RollbackMode,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

export interface BackupsFilter {
  cursor?: string;
  limit?: number;
  kind?: BackupKind;
}

/** The operations stream's endpoints, all gated by workspace.system.manage. */
export function operationsEndpoints(http: Http) {
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
    updates: {
      overview: async () => http.request('/api/v1/admin/updates', updatesOverviewSchema),
      /** 409 without an updater: the error details carry the `sudo bemmoly upgrade` command. */
      apply: async (version: string) =>
        http.request('/api/v1/admin/updates/apply', updaterAcceptedSchema, {
          method: 'POST',
          body: validated(applyUpdateRequestSchema, { version }),
        }),
      /** 409 when the plan changed since the dialog showed it; refetch and show the new one. */
      rollback: async (expectedMode: RollbackMode, preferRestore = false) =>
        http.request('/api/v1/admin/updates/rollback', updaterAcceptedSchema, {
          method: 'POST',
          body: validated(rollbackRequestSchema, { expectedMode, preferRestore }),
        }),
      /** Air-gapped installs: upload a release bundle. */
      uploadBundle: async (file: File) =>
        http.upload('/api/v1/admin/updates/catalog-upload', catalogUploadResponseSchema, file, {
          filename: file.name,
        }),
    },
    system: {
      /** Anonymous while no admin exists, so the wizard's first step can show it. */
      health: async () => http.request('/api/v1/admin/system', systemHealthResponseSchema),
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
