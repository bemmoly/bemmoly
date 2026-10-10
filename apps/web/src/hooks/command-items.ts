import {
  buildSettingsNav,
  flattenSettings,
  knownIcon,
  type CommandItem,
  type RecentItem,
  type RecentLook,
  type ScreenAction,
  type SettingsViewer,
} from '@bemmoly/core-web';
import type { ModuleManifest, SearchResult, User } from '@bemmoly/shared';
import type { IconName } from '@bemmoly/ui/icons';
import type { PaletteScope } from '../store/ui.ts';

export interface PaletteItem extends CommandItem {
  /** Runs before navigating to `href` (when there is one). */
  run?: () => void;
  icon?: IconName;
  /** An issue's type tile and status, in place of the icon. */
  look?: RecentLook;
  /** A record's short handle, such as an issue key, printed in mono before the title. */
  issueKey?: string;
  /** The shortcut that does the same thing. */
  keys?: string;
  /** Found and ranked by a module's search provider, so ⌘K does not filter it again. */
  fromServer?: boolean;
  person?: boolean;
  /** A recent item's own type ("Issues", "Pages"), so a type filter keeps it. */
  kindGroup?: string;
  /** A record's own stored icon (a page's emoji or icon name), drawn as the page icon. */
  recordIcon?: string | null;
  /** The line that matched, with <b> around each hit. */
  snippet?: string;
  /** The container's key (a space's "ENG"), for the palette's place filter. */
  placeKey?: string;
}

export interface PaletteScopeEntry {
  value: PaletteScope;
  label: string;
  group?: string;
}

/** All, then one scope per module search group (Issues, Pages), then the kernel's own. */
export function paletteScopes(modules: readonly ModuleManifest[]): PaletteScopeEntry[] {
  const found = modules
    .flatMap((module) => module.search ?? [])
    .map((group) => ({ value: group.kind, label: group.label, group: group.label }));
  return [
    { value: 'all', label: 'All' },
    ...found,
    { value: 'people', label: 'People', group: 'People' },
    { value: 'settings', label: 'Settings', group: 'Settings' },
    { value: 'actions', label: 'Actions', group: 'Actions' },
  ];
}

export interface PaletteSources {
  viewer: SettingsViewer;
  canManagePeople: boolean;
  modules: readonly ModuleManifest[];
  users: readonly User[];
  searchHits: readonly SearchResult[];
  /** What the screen on show offers ("Assign PLT-204 to me"). */
  screenActions?: readonly ScreenAction[];
  /** What the New button makes, the first being C. */
  creates?: readonly { id: string; label: string; icon?: string | undefined; open: () => void }[];
  run: {
    invite: () => void;
    shortcuts: () => void;
    mode: (mode: 'light' | 'dark') => void;
    signOut: () => void;
  };
}

const action = (id: string, title: string, rest: Partial<PaletteItem>): PaletteItem => ({
  id,
  group: 'Actions',
  title,
  href: '',
  ...rest,
});

const nav = (id: string, title: string, href: string, rest: Partial<PaletteItem>): PaletteItem => ({
  id,
  group: 'Navigation',
  title,
  href,
  ...rest,
});

/** A recent item as a palette row, under its own type's group when the person filters. */
export function recentItem(item: RecentItem): PaletteItem {
  return {
    id: `recent:${item.id}`,
    group: 'Recent',
    title: item.title,
    ...(item.context ? { subtitle: item.context } : {}),
    ...(item.handle ? { issueKey: item.handle, keywords: [item.handle] } : {}),
    href: item.path,
    look: item.look,
    kindGroup: item.group,
  };
}

function screenItems(sources: PaletteSources): PaletteItem[] {
  return (sources.screenActions ?? []).map((entry) =>
    action(`screen:${entry.id}`, entry.title, {
      run: entry.run,
      ...(entry.look ? { look: entry.look } : {}),
      ...(entry.keys ? { keys: entry.keys } : {}),
      ...(entry.keywords ? { keywords: [...entry.keywords] } : {}),
    }),
  );
}

function navigation(sources: PaletteSources): PaletteItem[] {
  const entries = sources.modules.flatMap((module) =>
    module.navigation
      .filter((entry) => entry.placement === 'command')
      .map((entry) => ({
        entry,
        icon: knownIcon(entry.icon) ?? knownIcon(module.icon) ?? 'modules',
      })),
  );
  return [
    nav('go:home', 'Home', '/', { icon: 'home', keys: 'G H' }),
    nav('go:inbox', 'Inbox', '/inbox', { icon: 'inbox', keys: 'G I', keywords: ['notifications'] }),
    ...entries.map(({ entry, icon }) =>
      nav(`go:${entry.id}`, entry.label, entry.path, {
        icon,
        ...(entry.keys ? { keys: entry.keys } : {}),
      }),
    ),
    nav('go:settings', 'Settings', '/settings', { icon: 'settings' }),
  ];
}

/**
 * Everything ⌘K can open besides recents: what module search providers found (issues by key
 * and keyword, pages), people, the settings pages this person may open, actions (the screen's
 * own first, then creating, inviting, theme) and navigation.
 */
export function paletteItems(sources: PaletteSources): PaletteItem[] {
  const found: PaletteItem[] = sources.searchHits
    .filter((hit) => hit.kind !== 'user')
    .map((hit) => ({
      id: `${hit.kind}:${hit.id}`,
      group: hit.group ?? hit.kind,
      title: hit.title,
      ...(hit.context || hit.subtitle ? { subtitle: hit.context ?? hit.subtitle ?? '' } : {}),
      // Only an issue prints its key; a page shows its icon and its place instead.
      ...(hit.key && hit.look?.type ? { issueKey: hit.key } : {}),
      ...(hit.key ? { placeKey: hit.key } : {}),
      ...(hit.look && 'icon' in hit.look ? { recordIcon: hit.look.icon ?? null } : {}),
      ...(hit.snippet ? { snippet: hit.snippet } : {}),
      href: hit.href,
      ...(hit.look?.type
        ? {
            look: {
              kind: 'issue',
              type: hit.look.type,
              ...(hit.look.status ? { status: hit.look.status } : {}),
            },
          }
        : { icon: /doc|page/.test(hit.kind) ? ('doc' as const) : ('board' as const) }),
      fromServer: true,
    }));
  const people = new Map<string, PaletteItem>();
  const person = (id: string, title: string, subtitle: string | undefined, href: string) =>
    people.set(id, { id: `user:${id}`, group: 'People', title, subtitle, href, person: true });
  for (const user of sources.users) person(user.id, user.name, user.email, '/settings/users');
  for (const hit of sources.searchHits) {
    if (hit.kind === 'user' && !people.has(hit.id))
      person(hit.id, hit.title, hit.subtitle ?? undefined, hit.href);
  }
  const settings: PaletteItem[] = flattenSettings(
    buildSettingsNav(sources.modules, sources.viewer),
  ).map((entry) => ({
    id: `setting:${entry.id}`,
    group: 'Settings',
    title: entry.label,
    keywords: [...entry.id.split('-'), 'settings'],
    href: entry.path,
    icon: entry.icon,
  }));
  const creates = (sources.creates ?? []).map((entry, index) =>
    action(`create:${entry.id}`, `New ${entry.label.toLowerCase()}`, {
      // The primary create is C, drawn with the New button's plus; the rest keep their own.
      icon: index === 0 ? 'plus' : (knownIcon(entry.icon) ?? 'plus'),
      run: entry.open,
      keywords: ['create', 'add'],
      ...(index === 0 ? { keys: 'C' } : {}),
    }),
  );
  const actions: PaletteItem[] = [
    ...screenItems(sources),
    ...creates,
    ...(sources.canManagePeople
      ? [
          action('invite', 'Invite people', {
            icon: 'people',
            keywords: ['user', 'email', 'add'],
            href: '/settings/users',
            run: sources.run.invite,
          }),
          action('team', 'New team', {
            icon: 'people',
            keywords: ['create'],
            href: '/settings/teams',
          }),
        ]
      : []),
    action('dark', 'Switch to dark mode', {
      icon: 'moon',
      keywords: ['theme'],
      run: () => sources.run.mode('dark'),
    }),
    action('light', 'Switch to light mode', {
      icon: 'sun',
      keywords: ['theme'],
      run: () => sources.run.mode('light'),
    }),
    action('shortcuts', 'Keyboard shortcuts', {
      icon: 'help',
      keys: '?',
      keywords: ['keys', 'help'],
      run: sources.run.shortcuts,
    }),
    action('sign-out', 'Sign out', {
      icon: 'arrow-left',
      keywords: ['log out'],
      run: sources.run.signOut,
    }),
  ];
  return [...found, ...people.values(), ...settings, ...actions, ...navigation(sources)];
}
