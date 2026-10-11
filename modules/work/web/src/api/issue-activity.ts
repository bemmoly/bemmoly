import {
  commentSchema,
  commentsPageSchema,
  createCommentBodySchema,
  createIssueLinkBodySchema,
  issueLinkSchema,
  issueLinksResponseSchema,
  listCommentsQuerySchema,
  reactToCommentBodySchema,
  updateCommentBodySchema,
  type CreateCommentBody,
  type CreateIssueLinkBody,
  type ListCommentsQuery,
  type ReactToCommentBody,
  type UpdateCommentBody,
} from '../../../shared/index.ts';
import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';

const BASE = '/api/v1/work';

/** Comments with their threads and reactions, and the links between issues. */
export function workIssueActivityEndpoints(http: Http) {
  return {
    comments: {
      list: async (issueKey: string, query: Partial<ListCommentsQuery> = {}) =>
        http.request(`${BASE}/issues/${enc(issueKey)}/comments`, commentsPageSchema, {
          query: validated(listCommentsQuerySchema, query),
        }),
      create: async (issueKey: string, body: CreateCommentBody) =>
        http.request(`${BASE}/issues/${enc(issueKey)}/comments`, commentSchema, {
          method: 'POST',
          body: validated(createCommentBodySchema, body),
          idempotent: true,
        }),
      update: async (id: string, body: UpdateCommentBody) =>
        http.request(`${BASE}/comments/${enc(id)}`, commentSchema, {
          method: 'PATCH',
          body: validated(updateCommentBodySchema, body),
        }),
      remove: async (id: string) => http.send(`${BASE}/comments/${enc(id)}`, { method: 'DELETE' }),
      /** Adds the viewer's reaction, or removes it with `on: false`. */
      react: async (id: string, body: ReactToCommentBody) =>
        http.request(`${BASE}/comments/${enc(id)}/reactions`, commentSchema, {
          method: 'PUT',
          body: validated(reactToCommentBodySchema, body),
        }),
    },
    issueLinks: {
      list: async (issueKey: string) =>
        (await http.request(`${BASE}/issues/${enc(issueKey)}/links`, issueLinksResponseSchema))
          .items,
      create: async (issueKey: string, body: CreateIssueLinkBody) =>
        http.request(`${BASE}/issues/${enc(issueKey)}/links`, issueLinkSchema, {
          method: 'POST',
          body: validated(createIssueLinkBodySchema, body),
        }),
      remove: async (id: string) => http.send(`${BASE}/links/${enc(id)}`, { method: 'DELETE' }),
    },
  };
}
