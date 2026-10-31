import { preloadable, type Preloadable } from '@bemmoly/core-web';

export interface PeopleScreenProps {
  /** The segment after the screen's: a user id, a journey id, a time off tab. */
  segment: string | undefined;
}

type Screen = Preloadable<PeopleScreenProps>;

/**
 * Subpath to screen, one line each: none is the directory, "p" a profile, "org" the chart,
 * "time-off" time off (its tab or the request dialog after it), "journeys" the journeys and
 * one journey. Each screen is its own lazy file.
 */
export const PEOPLE_SCREENS: Readonly<Record<string, Screen>> = {
  directory: preloadable(() => import('./directory/directory-screen.tsx')),
  p: preloadable(() => import('./profile/profile-screen.tsx')),
  org: preloadable(() => import('./org/org-screen.tsx')),
  'time-off': preloadable(() => import('./time-off/time-off-screen.tsx')),
  journeys: preloadable(() => import('./journeys/journeys-screen.tsx')),
};

/** "/p/123" is the profile with segment "123"; "" is the directory. */
export function resolvePeopleRoute(subpath: string) {
  const [screen = 'directory', segment] = subpath.split('/').filter(Boolean);
  const Screen = PEOPLE_SCREENS[screen];
  return Screen ? { Screen, name: screen, props: { segment } satisfies PeopleScreenProps } : null;
}
