import {
  createInitiativeBodySchema,
  initiativeSchema,
  initiativesPageSchema,
  linkInitiativeEpicBodySchema,
  listInitiativesQuerySchema,
  updateInitiativeBodySchema,
  type CreateInitiativeBody,
  type ListInitiativesQueryInput,
  type UpdateInitiativeBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work/initiatives';

/** /api/v1/work/initiatives: programs of epics; their timeline is the roadmap's `?initiative=`. */
export function workInitiativeEndpoints(http: Http) {
  const one = (id: string) => `${BASE}/${enc(id)}`;
  return {
    list: async (query: ListInitiativesQueryInput = {}, options: { signal?: AbortSignal } = {}) =>
      http.request(BASE, initiativesPageSchema, {
        query: validated(listInitiativesQuerySchema, query),
        ...(options.signal ? { signal: options.signal } : {}),
      }),
    get: async (id: string, options: { signal?: AbortSignal } = {}) =>
      http.request(one(id), initiativeSchema, options.signal ? { signal: options.signal } : {}),
    create: async (body: CreateInitiativeBody) =>
      http.request(BASE, initiativeSchema, {
        method: 'POST',
        body: validated(createInitiativeBodySchema, body),
      }),
    update: async (id: string, body: UpdateInitiativeBody) =>
      http.request(one(id), initiativeSchema, {
        method: 'PATCH',
        body: validated(updateInitiativeBodySchema, body),
      }),
    archive: async (id: string) =>
      http.request(`${one(id)}/archive`, initiativeSchema, { method: 'POST' }),
    unarchive: async (id: string) =>
      http.request(`${one(id)}/unarchive`, initiativeSchema, { method: 'POST' }),
    linkEpic: async (id: string, epicId: string) =>
      http.request(`${one(id)}/epics`, initiativeSchema, {
        method: 'POST',
        body: validated(linkInitiativeEpicBodySchema, { epicId }),
      }),
    unlinkEpic: async (id: string, epicId: string) =>
      http.send(`${one(id)}/epics/${enc(epicId)}`, { method: 'DELETE' }),
  };
}
