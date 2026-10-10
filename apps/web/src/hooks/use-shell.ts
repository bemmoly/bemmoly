import { inSidebarOrder, moduleName, openCreate, type ScreenAction } from '@bemmoly/core-web';
import type { ModuleManifest, SidebarLink } from '@bemmoly/shared';
import { PRESETS } from '@bemmoly/ui/tokens';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { MODULE_CREATES } from '../lib/module-shell.ts';
import { useThemeStore } from '../store/theme.ts';
import { useUiStore } from '../store/ui.ts';
import { useModules } from './use-modules.ts';
import { useInbox } from './use-notifications.ts';
import { useMe, useSignOut } from './use-session.ts';
import { useWorkspace } from './use-workspace.ts';

/** One thing the New button makes, from an enabled module's "create" navigation entry. */
export interface CreateEntry {
  id: string;
  label: string;
  moduleId: string;
  icon: string | undefined;
  open: () => void;
}

export interface ThemeChoice {
  id: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}

/** The release this build is, for the sidebar footer's version line. */
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const WHATS_NEW_URL = 'https://bemmoly.com/changelog';

/** Everything the frame needs from the session, the modules, the inbox and the theme. */
export function useShell() {
  const me = useMe();
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { data = [] } = useModules();
  const modules = useMemo(() => inSidebarOrder(data), [data]);
  const { unreadCount } = useInbox();
  const signOut = useSignOut();
  const openPalette = useUiStore((state) => state.openPalette);
  const requestInvite = useUiStore((state) => state.requestInvite);
  const { mode, preset, setMode, setPreset } = useThemeStore();
  const policy = workspace.appearance.policy;
  const go = (to: string) => void navigate({ to });

  /** The module's dialog over this page when it ships one; its old page otherwise. */
  const creates: CreateEntry[] = modules.flatMap((module) =>
    module.navigation
      .filter((entry) => entry.placement === 'create')
      .map((entry) => ({
        id: entry.id,
        label: entry.label,
        moduleId: module.id,
        icon: entry.icon,
        open: () => (MODULE_CREATES.has(entry.id) ? openCreate(entry.id) : go(entry.path)),
      })),
  );

  const primary: Array<SidebarLink & { moduleId: string }> = modules.flatMap((module) =>
    (module.sidebar?.primary ?? []).map((link) => ({ ...link, moduleId: module.id })),
  );

  const themes: ThemeChoice[] = [
    ...(policy.memberModeSwitch
      ? (['light', 'dark', 'system'] as const).map((value) => ({
          id: `mode-${value}`,
          label: value === 'system' ? 'Workspace default' : value === 'light' ? 'Light' : 'Dark',
          checked: mode === value && !preset,
          onSelect: () => {
            setPreset(null);
            setMode(value);
          },
        }))
      : []),
    ...(policy.personalThemes
      ? PRESETS.filter((entry) => entry.id !== 'light' && entry.id !== 'dark').map((entry) => ({
          id: `preset-${entry.id}`,
          label: entry.name,
          checked: preset === entry.id,
          onSelect: () => setPreset(entry.id),
        }))
      : []),
  ];

  return {
    me,
    workspace,
    modules,
    unreadCount,
    creates,
    /** C and the New button: the first module's first create entry (Work's new issue). */
    primaryCreate: creates[0] ?? null,
    primary,
    themes,
    canInvite: me.can('workspace.roles.manage'),
    canManageAppearance: me.can('workspace.appearance.manage'),
    invite: () => {
      requestInvite(true);
      go('/settings/users');
    },
    search: () => openPalette('all'),
    signOut: () => signOut.mutate(),
    go,
  };
}

export type Shell = ReturnType<typeof useShell>;

/** The module whose area the address is in, for the bottom bar and the palette. */
export function moduleAt(modules: readonly ModuleManifest[], pathname: string) {
  return modules.find(
    (module) => pathname === `/${module.id}` || pathname.startsWith(`/${module.id}/`),
  );
}

/** "Go to Work" and the other module areas, as palette navigation. */
export function areaActions(
  modules: readonly ModuleManifest[],
  go: (path: string) => void,
): ScreenAction[] {
  return modules.map((module) => ({
    id: `area:${module.id}`,
    title: `Go to ${moduleName(module)}`,
    look: { kind: 'icon', icon: module.icon ?? 'modules', moduleId: module.id },
    run: () => go(module.sidebar?.path ?? `/${module.id}`),
  }));
}
