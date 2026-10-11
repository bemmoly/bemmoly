import {
  createImportBodySchema,
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
      http.request(`${IMPORTS}/${enc(id)}`, importJobSchema, {
        method: 'PATCH',
        body: validated(updateImportBodySchema, body),
      }),
    run: async (id: string) =>
      http.request(`${IMPORTS}/${enc(id)}/run`, importJobSchema, { method: 'POST' }),
    cancel: async (id: string) =>
      http.request(`${IMPORTS}/${enc(id)}/cancel`, importJobSchema, { method: 'POST' }),
  };
}
