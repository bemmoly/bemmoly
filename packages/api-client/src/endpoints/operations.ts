import {
  applyUpdateRequestSchema,
  catalogUploadResponseSchema,
  rollbackRequestSchema,
  systemHealthResponseSchema,
  updaterAcceptedSchema,
  updatesOverviewSchema,
  type ListAuditLogQuery,
  type RollbackMode,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { validated } from './validate.ts';

/** The operations stream's endpoints, all gated by workspace.system.manage. Backups
 * and the audit log read live in `operations-admin.ts`, out of the shell's first load. */
export function operationsEndpoints(http: Http) {
  return {
    updates: {
      overview: async () => http.request('/api/v1/admin/updates', updatesOverviewSchema),
      /** Fetches the release list now; the answer is the refreshed overview. */
      check: async () =>
        http.request('/api/v1/admin/updates/check', updatesOverviewSchema, { method: 'POST' }),
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
