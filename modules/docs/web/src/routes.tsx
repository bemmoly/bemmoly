import { preloadable, type Preloadable } from '@bemmoly/core-web';

export interface DocsScreenProps {
  /** The second path segment: a space key for /docs/s/ENG, a page id for /docs/p/:id. */
  segment: string | undefined;
  /** Anything after it, for screens that nest deeper. */
  rest: string[];
  /** The first segment: "s", "p", or "create" and "spaces" for the Create menu's dialogs. */
  screen: string;
}

type Screen = Preloadable<DocsScreenProps>;

const home = preloadable(() => import('./home/docs-home-screen.tsx'));

/**
 * Subpath → screen, one line each. The first segment picks the screen: none
 * is the Docs home, "s" a space (and its trash), "p" a page. The Create
 * menu's entries are the home with the new-page picker (/create) or the
 * create-space dialog (/spaces/new) open over it. Each screen is its own
 * lazy file, so opening a page does not load the home; index.tsx loads it
 * before rendering it.
 */
export const DOCS_SCREENS: Readonly<Record<string, Screen>> = {
  home,
  s: preloadable(() => import('./space/space-screen.tsx')),
  p: preloadable(() => import('./page/page-screen.tsx')),
  create: home,
  spaces: home,
};

/** "/s/ENG" → the space screen with segment "ENG"; "" → the Docs home. */
export function resolveDocsRoute(subpath: string) {
  const [screen = 'home', segment, ...rest] = subpath.split('/').filter(Boolean);
  const Screen = DOCS_SCREENS[screen];
  const name = screen === 'create' || screen === 'spaces' ? 'home' : screen;
  return Screen
    ? { Screen, name, props: { segment, rest, screen } satisfies DocsScreenProps }
    : null;
}
