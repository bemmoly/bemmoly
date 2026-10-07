import {
  buildSettingsNav,
  flattenSettings,
  type CommandItem,
  type SettingsViewer,
} from '@bemmoly/core-web';
import type { ModuleManifest, SearchResult, User } from '@bemmoly/shared';

export interface PaletteItem extends CommandItem {
  /** Runs before navigating to `href` (when there is one). */
  run?: () => void;
  glyph: string;
}

export interface PaletteSources {
  viewer: SettingsViewer;
  canManagePeople: boolean;
  modules: readonly ModuleManifest[];
  users: readonly User[];
  searchHits: readonly SearchResult[];
  run: {
    invite: () => void;
    inbox: () => void;
    mode: (mode: 'light' | 'dark') => void;
    signOut: () => void;
  };
}

const action = (
  id: string,
  title: string,
  glyph: string,
  rest: Partial<PaletteItem>,
): PaletteItem => ({
  id,
  group: 'Actions',
  title,
  glyph,
  href: '',
  ...rest,
});

/**
 * Everything ⌘K can open: people (the directory plus server search hits),
 * settings pages this person may open, and actions, including what "Create"
 * offers (module create entries, invite, team).
 */
export function paletteItems(sources: PaletteSources): PaletteItem[] {
  const people = new Map<string, PaletteItem>();
  for (const user of sources.users) {
    people.set(user.id, {
      id: `user:${user.id}`,
      group: 'People',
      title: user.name,
      subtitle: user.email,
      href: '/settings/users',
      glyph: '',
    });
  }
  for (const hit of sources.searchHits) {
    if (!people.has(hit.id)) {
      people.set(hit.id, {
        id: `user:${hit.id}`,
        group: 'People',
        title: hit.title,
        subtitle: hit.subtitle ?? undefined,
        href: hit.href,
        glyph: '',
      });
    }
  }
  const settings = flattenSettings(buildSettingsNav(sources.modules, sources.viewer)).map(
    (entry) => ({
      id: `setting:${entry.id}`,
      group: 'Settings',
      title: entry.label,
      subtitle: 'Settings',
      keywords: entry.id.split('-'),
      href: entry.path,
      glyph: '⚙',
    }),
  );
  const entries = sources.modules.flatMap((module) => module.navigation);
  const creates = entries
    .filter((entry) => entry.placement === 'create')
    .map((entry) =>
      action(`create:${entry.id}`, `Create ${entry.label.toLowerCase()}`, '+', {
        href: entry.path,
        keywords: ['create', 'new'],
      }),
    );
  const goTo = entries
    .filter((entry) => entry.placement === 'command' || entry.placement === 'top')
    .map((entry) => action(`go:${entry.id}`, `Go to ${entry.label}`, '›', { href: entry.path }));
  const actions: PaletteItem[] = [
    ...creates,
    ...(sources.canManagePeople
      ? [
          action('invite', 'Invite people', '+', {
            keywords: ['create', 'user', 'email'],
            href: '/settings/users',
            run: sources.run.invite,
          }),
          action('team', 'Create team', '+', {
            keywords: ['create', 'new'],
            href: '/settings/teams',
          }),
        ]
      : []),
    action('inbox', 'Open inbox', '›', { keywords: ['notifications'], run: sources.run.inbox }),
    action('dark', 'Switch to dark mode', '◐', {
      keywords: ['theme'],
      run: () => sources.run.mode('dark'),
    }),
    action('light', 'Switch to light mode', '◐', {
      keywords: ['theme'],
      run: () => sources.run.mode('light'),
    }),
    ...goTo,
    action('sign-out', 'Sign out', '›', { keywords: ['log out'], run: sources.run.signOut }),
  ];
  return [...people.values(), ...settings, ...actions];
}
