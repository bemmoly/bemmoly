import type { DocServices, SuggestionItem } from '@bemmoly/editor';
import { useMemo } from 'react';
import { api } from '../../shared/api.ts';
import { docsPaths, navigateTo } from '../../shared/navigation.ts';

/**
 * The palette kind Work registers its issues under in the kernel's search registry. Docs asks
 * the kernel by this name and never imports Work: with Work off, the search returns nothing
 * and the # menu stays empty.
 */
const ISSUE_SEARCH_KIND = 'work.issue';

const SPACE = /\s+/;

/** An empty query lists nothing: the menus wait for a first letter. */
const typed = (query: string) => query.trim().length > 0;

async function searchPages(query: string, pageId: string): Promise<SuggestionItem[]> {
  if (!typed(query)) return [];
  const hits = await api.docs.search.suggest({ q: query.trim().slice(0, 60), limit: 8 });
  return hits
    .filter((hit) => hit.id !== pageId)
    .map((hit) => ({ id: hit.id, label: hit.title || 'Untitled', description: hit.spaceKey }));
}

async function searchPeople(query: string, signal: AbortSignal): Promise<SuggestionItem[]> {
  const q = query.trim().split(SPACE).join(' ');
  const page = await api.users.list(
    { limit: 8, status: 'active', ...(q ? { q } : {}) },
    { signal },
  );
  return page.items.map((user) => ({
    id: user.id,
    label: user.name?.trim() || user.email,
    description: user.email,
  }));
}

async function searchIssues(query: string): Promise<SuggestionItem[]> {
  if (!typed(query)) return [];
  const { items } = await api.search({ q: query.trim(), kinds: [ISSUE_SEARCH_KIND], limit: 8 });
  return items.map((item) => ({
    id: item.key ?? item.id,
    label: item.key ?? item.title,
    description: item.title,
  }));
}

/**
 * What the Docs page lends its editor: [[ page links from Docs search, @ people from the
 * workspace, # issues through the kernel's search registry, and in-app navigation for link
 * clicks. Uploads are absent (the kernel has no upload endpoint yet), so images go in by
 * link; issue chips print quietly without a renderer from Work; AI arrives with its runtime.
 */
export function useDocServices(pageId: string): DocServices {
  return useMemo<DocServices>(
    () => ({
      searchPages: (query) => searchPages(query, pageId),
      pageHref: (id) => docsPaths.page(id),
      searchPeople,
      searchIssues: (query) => searchIssues(query),
      onNavigate: navigateTo,
    }),
    [pageId],
  );
}
