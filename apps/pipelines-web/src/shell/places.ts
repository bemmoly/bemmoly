import type { IconName } from '@bemmoly/ui/icons';

/** The ids of the shell's place names in the catalog: pipelines.shell.place.<id>. */
export type PlaceId =
  'forYou' | 'map' | 'catalog' | 'runs' | 'releases' | 'insights' | 'platform' | 'settings';

export interface Place {
  id: PlaceId;
  /** Inside the app: the router adds /pipelines. */
  path: string;
  icon: IconName;
  /** "G, then a letter", shown in the palette and the rail's tooltips. */
  keys: string;
  /** Whether the screen shows "this scope" and so keeps ?scope= when you move to it. */
  scoped: boolean;
  /** Other paths that belong to this place: an application's page is in the Catalog. */
  also?: readonly string[];
}

/**
 * The rail's seven places, then Settings at its foot (product design, "The shell"). On a phone
 * the first four are the bottom bar and the rest sit behind More.
 */
export const PLACES: readonly Place[] = [
  { id: 'forYou', path: '/', icon: 'home', keys: 'G Y', scoped: false },
  { id: 'map', path: '/map', icon: 'map', keys: 'G M', scoped: true },
  {
    id: 'catalog',
    path: '/catalog',
    icon: 'grid',
    keys: 'G C',
    scoped: true,
    also: ['/applications'],
  },
  { id: 'runs', path: '/runs', icon: 'play', keys: 'G R', scoped: true },
  { id: 'releases', path: '/releases', icon: 'rocket', keys: 'G E', scoped: true },
  { id: 'insights', path: '/insights', icon: 'reports', keys: 'G I', scoped: true },
  { id: 'platform', path: '/platform', icon: 'server', keys: 'G P', scoped: false },
];

export const SETTINGS: Place = {
  id: 'settings',
  path: '/settings',
  icon: 'gear',
  keys: 'G S',
  scoped: false,
};

export const PHONE_PLACES = PLACES.slice(0, 4);
export const MORE_PLACES = [...PLACES.slice(4), SETTINGS];

/** The place the address is in: For you only at the root, the others at and under their path. */
export function placeAt(pathname: string): Place | undefined {
  const inner = pathname.replace(/^\/pipelines/, '') || '/';
  const under = (path: string) => inner === path || inner.startsWith(`${path}/`);
  return [...PLACES, SETTINGS].find((place) =>
    place.path === '/' ? inner === '/' : [place.path, ...(place.also ?? [])].some(under),
  );
}
