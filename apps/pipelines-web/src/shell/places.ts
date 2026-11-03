import type { PlaceKey } from '@bemmoly/module-pipelines/shared';
import type { IconName } from '@bemmoly/ui/icons';

/** The ids of the shell's place names in the catalog: pipelines.shell.place.<id>. */
export type PlaceId =
  'forYou' | 'services' | 'runs' | 'changes' | 'environments' | 'platform' | 'settings';

export interface Place {
  id: PlaceId;
  /** The place as roles name it (shared/roles.ts); Settings is everyone's and has none. */
  key: PlaceKey | null;
  /** Inside the app: the router adds /pipelines. */
  path: string;
  icon: IconName;
  /** "G, then a letter", shown in the palette and the rail's tooltips. */
  keys: string;
  /** Whether the screen shows "this scope" and so keeps ?scope= when you move to it. */
  scoped: boolean;
  /** Other paths that belong to this place: an application's page is in Services. */
  also?: readonly string[];
}

/**
 * The rail's six places, then Settings at its foot (the simpler Pipelines prototype). Which of
 * them a person sees is their role's (`visiblePlaces`). The older screens (Map, Catalog,
 * Releases, Insights) keep their addresses until they retire, under the place they fold into.
 */
export const PLACES: readonly Place[] = [
  { id: 'forYou', key: 'home', path: '/', icon: 'home', keys: 'G Y', scoped: false },
  {
    id: 'services',
    key: 'services',
    path: '/services',
    icon: 'grid',
    keys: 'G V',
    scoped: true,
    also: ['/applications', '/catalog', '/map', '/insights'],
  },
  { id: 'runs', key: 'runs', path: '/runs', icon: 'play', keys: 'G R', scoped: true },
  {
    id: 'changes',
    key: 'changes',
    path: '/changes',
    icon: 'checklist',
    keys: 'G C',
    scoped: false,
    also: ['/releases'],
  },
  {
    id: 'environments',
    key: 'environments',
    path: '/environments',
    icon: 'layers',
    keys: 'G E',
    scoped: false,
  },
  {
    id: 'platform',
    key: 'platform',
    path: '/platform',
    icon: 'server',
    keys: 'G P',
    scoped: false,
    also: ['/setup'],
  },
];

export const SETTINGS: Place = {
  id: 'settings',
  key: null,
  path: '/settings',
  icon: 'gear',
  keys: 'G S',
  scoped: false,
};

/**
 * The places a role shows, in rail order. Without the role's list (before /me says it) every
 * place shows; the server still refuses what a role may not do.
 */
export function visiblePlaces(allowed: readonly PlaceKey[] | undefined): readonly Place[] {
  return allowed ? PLACES.filter((place) => place.key && allowed.includes(place.key)) : PLACES;
}

/** On a phone the first four are the bottom bar and the rest sit behind More. */
export function phonePlaces(places: readonly Place[]) {
  return { bar: places.slice(0, 4), more: [...places.slice(4), SETTINGS] };
}

/** The place the address is in: For you only at the root, the others at and under their path. */
export function placeAt(pathname: string): Place | undefined {
  const inner = pathname.replace(/^\/pipelines/, '') || '/';
  const under = (path: string) => inner === path || inner.startsWith(`${path}/`);
  return [...PLACES, SETTINGS].find((place) =>
    place.path === '/' ? inner === '/' : [place.path, ...(place.also ?? [])].some(under),
  );
}
