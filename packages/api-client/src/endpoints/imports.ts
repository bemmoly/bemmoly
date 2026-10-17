import {
  createImportBodySchema,
  importContainerPageSchema,
  importPeoplePageSchema,
  importPlannedJobSchema,
  importTargetListSchema,
  runImportBodySchema,
  type RunImportBody,
  importCountBodySchema,
  importCountListSchema,
  importSelectionBodySchema,
  importSelectionSummarySchema,
  type ImportContainerQuery,
  type ImportCountBody,
  type ImportSelectionBody,
  importJobListSchema,
  importJobSchema,
  importSourceListSchema,
  updateImportBodySchema,
  type CreateImportBody,
  type UpdateImportBody,
} from '@bemmoly/shared';
import type { Http } from '../http.ts';
import { enc, validated } from './validate.ts';

const SOURCES = '/api/v1/admin/import-sources';
const IMPORTS = '/api/v1/admin/imports';

/**
 * Settings › Import and the wizard's import step: the sources enabled modules offer, then one
 * job from connect (discovery) through plan, run, cancel and resume.
 */
export function importEndpoints(http: Http) {
  return {
    sources: async () => http.request(SOURCES, importSourceListSchema),
    list: async () => http.request(IMPORTS, importJobListSchema),
    get: async (id: string) => http.request(`${IMPORTS}/${enc(id)}`, importJobSchema),
    create: async (body: CreateImportBody) =>
      http.request(IMPORTS, importJobSchema, {
        method: 'POST',
        body: validated(createImportBodySchema, body),
      }),
    update: async (id: string, body: UpdateImportBody) =>
      http.request(`${IMPORTS}/${enc(id)}`, importPlannedJobSchema, {
        method: 'PATCH',
        body: validated(updateImportBodySchema, body),
      }),
    /** Runs the plan; with `containers`, only those again (Retry), from their checkpoints. */
    run: async (id: string, body: RunImportBody = {}) =>
      http.request(`${IMPORTS}/${enc(id)}/run`, importJobSchema, {
        method: 'POST',
        body: validated(runImportBodySchema, body),
      }),
    /** Where the CSV of every skipped record is served, for a download link. */
    skipsUrl: (id: string) => http.url(`${IMPORTS}/${enc(id)}/skips.csv`),
    /** One page of the containers the connection found, searched and filtered. */
    containers: async (id: string, query: Partial<ImportContainerQuery> = {}) =>
      http.request(`${IMPORTS}/${enc(id)}/containers`, importContainerPageSchema, {
        query: {
          ...(query.q ? { q: query.q } : {}),
          filter: query.filter ?? 'all',
          ...(query.cursor ? { cursor: query.cursor } : {}),
          limit: query.limit ?? 100,
        },
      }),
    count: async (id: string, body: ImportCountBody) =>
      http.request(`${IMPORTS}/${enc(id)}/containers/counts`, importCountListSchema, {
        method: 'POST',
        body: validated(importCountBodySchema, body),
      }),
    /** The people the plan found, those who may need a hand first. */
    people: async (id: string, query: { cursor?: string; limit?: number } = {}) =>
      http.request(`${IMPORTS}/${enc(id)}/people`, importPeoplePageSchema, {
        query: { ...(query.cursor ? { cursor: query.cursor } : {}), limit: query.limit ?? 50 },
      }),
    /** Projects or spaces here this import can go into, for the Existing picker. */
    targets: async (id: string, query: { q?: string; limit?: number } = {}) =>
      http.request(`${IMPORTS}/${enc(id)}/targets`, importTargetListSchema, {
        query: { ...(query.q ? { q: query.q } : {}), limit: query.limit ?? 50 },
      }),
    selection: async (id: string) =>
      http.request(`${IMPORTS}/${enc(id)}/selection`, importSelectionSummarySchema),
    select: async (id: string, body: ImportSelectionBody) =>
      http.request(`${IMPORTS}/${enc(id)}/selection`, importSelectionSummarySchema, {
        method: 'PATCH',
        body: validated(importSelectionBodySchema, body),
      }),
    cancel: async (id: string) =>
      http.request(`${IMPORTS}/${enc(id)}/cancel`, importJobSchema, { method: 'POST' }),
  };
}
