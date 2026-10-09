import type { Http } from '@bemmoly/api-client';
import { enc, validated } from '@bemmoly/api-client';
import {
  createFromTemplateBodySchema,
  homePagesSchema,
  labelsResponseSchema,
  labelSuggestQuerySchema,
  labelSuggestResponseSchema,
  listTemplatesQuerySchema,
  pageDetailSchema,
  pageSearchResponseSchema,
  pageSuggestResponseSchema,
  recentPagesQuerySchema,
  searchPagesQuerySchema,
  setLabelsBodySchema,
  starredPagesQuerySchema,
  starResponseSchema,
  suggestPagesQuerySchema,
  templateDetailSchema,
  templatesResponseSchema,
  type CreateFromTemplateBody,
  type LabelSuggestQuery,
  type ListTemplatesQuery,
  type RecentPagesQuery,
  type SearchPagesQuery,
  type StarredPagesQuery,
  type SuggestPagesQuery,
} from '../../../shared/index.ts';
import { DOCS_BASE } from './pages.ts';

/** The Docs home lists, stars, labels, templates and search. */
export function docsLibraryEndpoints(http: Http) {
  const page = (id: string, rest: string) => `${DOCS_BASE}/pages/${enc(id)}${rest}`;
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
      get: async (id: string) =>
        http.request(`${DOCS_BASE}/templates/${enc(id)}`, templateDetailSchema),
      createPage: async (id: string, body: CreateFromTemplateBody) =>
        http.request(`${DOCS_BASE}/templates/${enc(id)}/pages`, pageDetailSchema, {
          method: 'POST',
          body: validated(createFromTemplateBodySchema, body),
          idempotent: true,
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
