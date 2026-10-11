import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  attentionQuerySchema,
  attentionResponseSchema,
  createFromTemplateBodySchema,
  createTemplateBodySchema,
  homePagesSchema,
  labelsResponseSchema,
  labelSuggestQuerySchema,
  labelSuggestResponseSchema,
  listTemplatesQuerySchema,
  orgTemplateSchema,
  orgTemplatesResponseSchema,
  pageDetailSchema,
  pageSearchResponseSchema,
  pageSuggestResponseSchema,
  recentPagesQuerySchema,
  reorderTemplatesBodySchema,
  searchPagesQuerySchema,
  setLabelsBodySchema,
  starredPagesQuerySchema,
  starResponseSchema,
  suggestPagesQuerySchema,
  templateDetailSchema,
  templatesResponseSchema,
  updateTemplateBodySchema,
  type AttentionQuery,
  type CreateFromTemplateBody,
  type CreateTemplateBody,
  type LabelSuggestQuery,
  type ListTemplatesQuery,
  type RecentPagesQuery,
  type SearchPagesQuery,
  type StarredPagesQuery,
  type SuggestPagesQuery,
  type UpdateTemplateBody,
} from '../../../shared/index.ts';
import { DOCS_BASE } from './pages.ts';

/** The Docs home lists, stars, labels, templates and search. */
export function docsLibraryEndpoints(http: Http) {
  const page = (id: string, rest: string) => `${DOCS_BASE}/pages/${enc(id)}${rest}`;
  const template = (id: string, rest = '') => `${DOCS_BASE}/templates/${enc(id)}${rest}`;
  return {
    home: {
      recent: async (query: Partial<RecentPagesQuery> = {}) =>
        http.request(`${DOCS_BASE}/home/recent`, homePagesSchema, {
          query: validated(recentPagesQuerySchema, query),
        }),
      starred: async (query: Partial<StarredPagesQuery> = {}) =>
        http.request(`${DOCS_BASE}/home/starred`, homePagesSchema, {
          query: validated(starredPagesQuerySchema, query),
        }),
      attention: async (query: Partial<AttentionQuery> = {}) =>
        http.request(`${DOCS_BASE}/home/attention`, attentionResponseSchema, {
          query: validated(attentionQuerySchema, query),
        }),
    },
    stars: {
      set: async (pageId: string, starred: boolean) =>
        http.request(page(pageId, '/star'), starResponseSchema, {
          method: starred ? 'PUT' : 'DELETE',
        }),
    },
    labels: {
      set: async (pageId: string, labels: string[]) =>
        http.request(page(pageId, '/labels'), labelsResponseSchema, {
          method: 'PUT',
          body: validated(setLabelsBodySchema, { labels }),
        }),
      suggest: async (query: Partial<LabelSuggestQuery> = {}) =>
        (
          await http.request(`${DOCS_BASE}/labels`, labelSuggestResponseSchema, {
            query: validated(labelSuggestQuerySchema, query),
          })
        ).items,
    },
    templates: {
      list: async (query: Partial<ListTemplatesQuery> = {}) =>
        (
          await http.request(`${DOCS_BASE}/templates`, templatesResponseSchema, {
            query: validated(listTemplatesQuerySchema, query),
          })
        ).items,
      get: async (id: string) => http.request(template(id), templateDetailSchema),
      createPage: async (id: string, body: CreateFromTemplateBody) =>
        http.request(template(id, '/pages'), pageDetailSchema, {
          method: 'POST',
          body: validated(createFromTemplateBodySchema, body),
          idempotent: true,
        }),
      create: async (body: CreateTemplateBody) =>
        http.request(`${DOCS_BASE}/templates`, templateDetailSchema, {
          method: 'POST',
          body: validated(createTemplateBodySchema, body),
          idempotent: true,
        }),
      update: async (id: string, body: UpdateTemplateBody) =>
        http.request(template(id), templateDetailSchema, {
          method: 'PATCH',
          body: validated(updateTemplateBodySchema, body),
        }),
      archive: async (id: string) =>
        http.request(template(id, '/archive'), orgTemplateSchema, { method: 'POST' }),
      restore: async (id: string) =>
        http.request(template(id, '/restore'), orgTemplateSchema, { method: 'POST' }),
      duplicate: async (id: string) =>
        http.request(template(id, '/duplicate'), templateDetailSchema, { method: 'POST' }),
    },
    /** Settings › Docs: the org-wide templates with the archived ones, and their order. */
    orgTemplates: {
      list: async () =>
        (await http.request(`${DOCS_BASE}/org-templates`, orgTemplatesResponseSchema)).items,
      reorder: async (ids: readonly string[]) =>
        http.send(`${DOCS_BASE}/org-templates/order`, {
          method: 'PUT',
          body: validated(reorderTemplatesBodySchema, { ids: [...ids] }),
        }),
    },
    search: {
      pages: async (query: SearchPagesQuery) =>
        (
          await http.request(`${DOCS_BASE}/search`, pageSearchResponseSchema, {
            query: validated(searchPagesQuerySchema, query),
          })
        ).items,
      suggest: async (query: SuggestPagesQuery) =>
        (
          await http.request(`${DOCS_BASE}/search/suggest`, pageSuggestResponseSchema, {
            query: validated(suggestPagesQuerySchema, query),
          })
        ).items,
    },
  };
}
