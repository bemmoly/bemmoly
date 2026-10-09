import {
  createSavedFilterBodySchema,
  savedFilterSchema,
  savedFiltersResponseSchema,
  updateSavedFilterBodySchema,
  type CreateSavedFilterBody,
  type UpdateSavedFilterBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const base = '/api/v1/work/filters';

export const savedFilterKeys = {
  all: () => ['work', 'saved-filters'] as const,
  /** The filters a project's board offers: the caller's own and those shared with their teams. */
  list: (projectKey: string) => ['work', 'saved-filters', projectKey] as const,
};

/** /api/v1/work/filters: saved LQL filters, private to their owner or shared with teams. */
export function workFiltersEndpoints(http: Http) {
  return {
    list: async (projectKey: string) =>
      (await http.request(base, savedFiltersResponseSchema, { query: { projectId: projectKey } }))
        .items,
    create: async (body: CreateSavedFilterBody) =>
      http.request(base, savedFilterSchema, {
        method: 'POST',
        body: validated(createSavedFilterBodySchema, body),
      }),
    update: async (id: string, body: UpdateSavedFilterBody) =>
      http.request(`${base}/${enc(id)}`, savedFilterSchema, {
        method: 'PATCH',
        body: validated(updateSavedFilterBodySchema, body),
      }),
    remove: async (id: string) => http.send(`${base}/${enc(id)}`, { method: 'DELETE' }),
  };
}
