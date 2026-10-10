import { usePage } from '../hooks/queries.ts';

export interface DocsPlace {
  /** The space the address is in: /docs/s/ENG, or the space of the page on show. */
  spaceKey: string | undefined;
  /** The page on show at /docs/p/:id. */
  pageId: string | undefined;
  /** That page's ancestors, root first, once it has loaded. */
  trail: readonly string[];
}

const NONE: readonly string[] = [];

/**
 * Where in Docs the address is, for the sidebar to open the right space and mark the right
 * row. A page's space comes from the page itself, which the page screen has usually loaded.
 */
export function useDocsPlace(pathname: string): DocsPlace {
  const [, area, screen, segment] = pathname.split('/');
  const inDocs = area === 'docs';
  const pageId = inDocs && screen === 'p' ? segment : undefined;
  const page = usePage(pageId);
  if (inDocs && screen === 's') return { spaceKey: segment, pageId: undefined, trail: NONE };
  const detail = pageId ? page.data : undefined;
  return {
    spaceKey: detail?.spaceKey,
    pageId,
    trail: detail?.breadcrumbs.map((crumb) => crumb.id) ?? NONE,
  };
}
