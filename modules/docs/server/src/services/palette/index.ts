import type {
  RequestContext,
  SearchProviderDefinition,
  SearchProviderQuery,
  SearchRegistry,
} from '@bemmoly/core';
import type { PageSuggestion } from '../../../../shared/search.ts';
import type { SearchService } from '../search/index.ts';

/** The palette's kind for Docs results, and the group they show under. */
export const DOCS_PAGE_SEARCH = { kind: 'docs.page', label: 'Pages' } as const;

/** Where a page opens in the web app. */
export const pagePath = (pageId: string) => `/docs/p/${pageId}`;

const STATUS_LABEL: Record<PageSuggestion['status'], string> = {
  draft: 'Draft',
  in_review: 'In review',
  published: 'Published',
  archived: 'Archived',
};

/**
 * Pages for ⌘K: the title lookup first, so a page typed by name leads, then
 * keyword search over the body, merged without repeats. Both already keep to
 * the spaces the person is in. The space key prints before the title.
 */
export function createPageSearchProvider(search: SearchService): SearchProviderDefinition {
  return {
    ...DOCS_PAGE_SEARCH,
    async search(ctx: RequestContext, query: SearchProviderQuery) {
      const q = query.q.trim();
      const byTitle = await search.suggest(ctx, {
        q: q.slice(0, 60),
        limit: Math.min(query.limit, 20),
      });
      const byWords = await search.search(ctx, { q: q.slice(0, 200), limit: query.limit });
      const merged = new Map<string, PageSuggestion>();
      for (const page of [...byTitle, ...byWords]) {
        if (!merged.has(page.id)) merged.set(page.id, page);
      }
      return [...merged.values()].slice(0, query.limit).map((page) => ({
        id: page.id,
        key: page.spaceKey,
        title: page.title || 'Untitled',
        subtitle: STATUS_LABEL[page.status],
        href: pagePath(page.id),
      }));
    },
  };
}

/** One line in module.ts: Docs answers the palette with pages. */
export function registerDocsSearch(registry: SearchRegistry, search: SearchService): void {
  registry.addProvider(createPageSearchProvider(search));
}
