import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export interface DocsScreenProps {
  /** The second path segment: a space key for /docs/s/ENG, a page id for /docs/p/:id. */
  segment: string | undefined;
  /** Anything after it, for screens that nest deeper. */
  rest: string[];
}

type Screen = LazyExoticComponent<ComponentType<DocsScreenProps>>;

const home = lazy(() => import('./home/docs-home-screen.tsx'));

/**
 * Subpath → screen, one line each. The first segment picks the screen: none
 * is the Docs home, "s" a space, "p" a page. The create entries of the top
 * bar land on the home until their dialogs arrive. Each screen is its own
 * lazy file, so opening a page does not load the home.
 */
export const DOCS_SCREENS: Readonly<Record<string, Screen>> = {
  home,
  s: lazy(() => import('./space/space-screen.tsx')),
  p: lazy(() => import('./page/page-screen.tsx')),
  create: home,
  spaces: home,
};

/** "/s/ENG" → the space screen with segment "ENG"; "" → the Docs home. */
export function resolveDocsRoute(subpath: string) {
  const [screen = 'home', segment, ...rest] = subpath.split('/').filter(Boolean);
  const Screen = DOCS_SCREENS[screen];
  const name = screen === 'create' || screen === 'spaces' ? 'home' : screen;
  return Screen ? { Screen, name, props: { segment, rest } satisfies DocsScreenProps } : null;
}
