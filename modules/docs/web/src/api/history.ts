import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  backlinksResponseSchema,
  commentsResponseSchema,
  compareRevisionsQuerySchema,
  createCommentBodySchema,
  createRevisionBodySchema,
  listCommentsQuerySchema,
  listRevisionsQuerySchema,
  outgoingLinksResponseSchema,
  pageCommentSchema,
  pageReferencesResponseSchema,
  referencesQuerySchema,
  revisionCompareSchema,
  revisionDetailSchema,
  revisionsPageSchema,
  revisionSummarySchema,
  setLinksBodySchema,
  updateCommentBodySchema,
  type CompareRevisionsQuery,
  type CreateCommentBody,
  type CreateRevisionBody,
  type ListCommentsQuery,
  type ListRevisionsQuery,
  type ReferencesQuery,
  type SetLinksBody,
  type UpdateCommentBody,
} from '../../../shared/index.ts';
import { DOCS_BASE } from './pages.ts';

/** A page's version history, its comments and its links, both ways. */
export function docsHistoryEndpoints(http: Http) {
  const page = (id: string, rest: string) => `${DOCS_BASE}/pages/${enc(id)}${rest}`;
  const comment = (id: string, rest = '') => `${DOCS_BASE}/comments/${enc(id)}${rest}`;
  return {
    revisions: {
      list: async (pageId: string, query: Partial<ListRevisionsQuery> = {}) =>
        http.request(page(pageId, '/revisions'), revisionsPageSchema, {
          query: validated(listRevisionsQuerySchema, query),
        }),
      get: async (pageId: string, revisionId: string) =>
        http.request(page(pageId, `/revisions/${enc(revisionId)}`), revisionDetailSchema),
      /** "Save version", optionally named. */
      create: async (pageId: string, body: CreateRevisionBody = {}) =>
        http.request(page(pageId, '/revisions'), revisionSummarySchema, {
          method: 'POST',
          body: validated(createRevisionBodySchema, body),
          idempotent: true,
        }),
      restore: async (pageId: string, revisionId: string) =>
        http.request(page(pageId, `/revisions/${enc(revisionId)}/restore`), revisionSummarySchema, {
          method: 'POST',
        }),
      /** `to` defaults to the page as it is now. */
      compare: async (pageId: string, query: Partial<CompareRevisionsQuery> & { from: string }) =>
        http.request(page(pageId, '/revisions/compare'), revisionCompareSchema, {
          query: validated(compareRevisionsQuerySchema, query),
        }),
    },
    comments: {
      list: async (pageId: string, query: ListCommentsQuery = {}) =>
        http.request(page(pageId, '/comments'), commentsResponseSchema, {
          query: validated(listCommentsQuerySchema, query),
        }),
      create: async (pageId: string, body: CreateCommentBody) =>
        http.request(page(pageId, '/comments'), pageCommentSchema, {
          method: 'POST',
          body: validated(createCommentBodySchema, body),
          idempotent: true,
        }),
      update: async (commentId: string, body: UpdateCommentBody) =>
        http.request(comment(commentId), pageCommentSchema, {
          method: 'PATCH',
          body: validated(updateCommentBodySchema, body),
        }),
      remove: async (commentId: string) => http.send(comment(commentId), { method: 'DELETE' }),
      resolve: async (commentId: string) =>
        http.request(comment(commentId, '/resolve'), pageCommentSchema, { method: 'POST' }),
      reopen: async (commentId: string) =>
        http.request(comment(commentId, '/reopen'), pageCommentSchema, { method: 'POST' }),
      applySuggestion: async (commentId: string) =>
        http.request(comment(commentId, '/apply-suggestion'), pageCommentSchema, {
          method: 'POST',
        }),
    },
    links: {
      outgoing: async (pageId: string) =>
        http.request(page(pageId, '/links'), outgoingLinksResponseSchema),
      setLinked: async (pageId: string, body: SetLinksBody) =>
        http.request(page(pageId, '/links'), outgoingLinksResponseSchema, {
          method: 'PUT',
          body: validated(setLinksBodySchema, body),
        }),
      backlinks: async (pageId: string) =>
        http.request(page(pageId, '/backlinks'), backlinksResponseSchema),
      /** "Referenced in": issues and other records that point at the page. */
      references: async (pageId: string) =>
        http.request(page(pageId, '/references'), pageReferencesResponseSchema),
      /** "Linked docs" for a record, by id or key. */
      linkedDocs: async (query: ReferencesQuery) =>
        http.request(`${DOCS_BASE}/references`, backlinksResponseSchema, {
          query: validated(referencesQuerySchema, query),
        }),
    },
  };
}
