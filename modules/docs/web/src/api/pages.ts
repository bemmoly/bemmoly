import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  createPageBodySchema,
  createSpaceBodySchema,
  listSpacesQuerySchema,
  listTrashQuerySchema,
  movePageBodySchema,
  moveResultSchema,
  pageDetailSchema,
  pageSummaryPageSchema,
  setReviewersBodySchema,
  setStatusBodySchema,
  spaceSchema,
  spacesPageSchema,
  treePageSchema,
  treeQuerySchema,
  updatePageBodySchema,
  updateSpaceBodySchema,
  type CreatePageBody,
  type CreateSpaceBody,
  type ListSpacesQuery,
  type ListTrashQuery,
  type MovePageBody,
  type SetReviewersBody,
  type SetStatusBody,
  type TreeQuery,
  type UpdatePageBody,
  type UpdateSpaceBody,
} from '../../../shared/index.ts';

export const DOCS_BASE = '/api/v1/docs';

/** Spaces, pages, the tree, moves and the review flow. Spaces take the key ("ENG") or id. */
export function docsPagesEndpoints(http: Http) {
  const space = (ref: string, rest = '') => `${DOCS_BASE}/spaces/${enc(ref)}${rest}`;
  const page = (id: string, rest = '') => `${DOCS_BASE}/pages/${enc(id)}${rest}`;
  return {
    spaces: {
      list: async (query: Partial<ListSpacesQuery> = {}) =>
        http.request(`${DOCS_BASE}/spaces`, spacesPageSchema, {
          query: validated(listSpacesQuerySchema, query),
        }),
      get: async (ref: string) => http.request(space(ref), spaceSchema),
      create: async (body: CreateSpaceBody) =>
        http.request(`${DOCS_BASE}/spaces`, spaceSchema, {
          method: 'POST',
          body: validated(createSpaceBodySchema, body),
          idempotent: true,
        }),
      update: async (ref: string, body: UpdateSpaceBody) =>
        http.request(space(ref), spaceSchema, {
          method: 'PATCH',
          body: validated(updateSpaceBodySchema, body),
        }),
      remove: async (ref: string) => http.send(space(ref), { method: 'DELETE' }),
      tree: async (ref: string, query: Partial<TreeQuery> = {}) =>
        http.request(space(ref, '/tree'), treePageSchema, {
          query: validated(treeQuerySchema, query),
        }),
      trash: async (ref: string, query: Partial<ListTrashQuery> = {}) =>
        http.request(space(ref, '/trash'), pageSummaryPageSchema, {
          query: validated(listTrashQuerySchema, query),
        }),
    },
    pages: {
      get: async (id: string, options: { deleted?: boolean } = {}) =>
        http.request(page(id), pageDetailSchema, {
          query: options.deleted ? { deleted: true } : {},
        }),
      create: async (body: CreatePageBody) =>
        http.request(`${DOCS_BASE}/pages`, pageDetailSchema, {
          method: 'POST',
          body: validated(createPageBodySchema, body),
          idempotent: true,
        }),
      update: async (id: string, body: UpdatePageBody) =>
        http.request(page(id), pageDetailSchema, {
          method: 'PATCH',
          body: validated(updatePageBodySchema, body),
        }),
      remove: async (id: string) => http.send(page(id), { method: 'DELETE' }),
      restore: async (id: string) =>
        http.request(page(id, '/restore'), pageDetailSchema, { method: 'POST' }),
      move: async (id: string, body: MovePageBody) =>
        http.request(page(id, '/move'), moveResultSchema, {
          method: 'POST',
          body: validated(movePageBodySchema, body),
        }),
      setStatus: async (id: string, body: SetStatusBody) =>
        http.request(page(id, '/status'), pageDetailSchema, {
          method: 'PUT',
          body: validated(setStatusBodySchema, body),
        }),
      setReviewers: async (id: string, body: SetReviewersBody) =>
        http.request(page(id, '/reviewers'), pageDetailSchema, {
          method: 'PUT',
          body: validated(setReviewersBodySchema, body),
        }),
    },
  };
}
