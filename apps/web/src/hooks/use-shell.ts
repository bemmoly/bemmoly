import {
  inSidebarOrder,
  moduleName,
  openCreate,
  productsOf,
  type Product,
  type ScreenAction,
} from '@bemmoly/core-web';
import type { ModuleManifest, SidebarLink } from '@bemmoly/shared';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { customerLogo } from '../lib/customer-logo.ts';
import { MODULE_CREATES } from '../lib/module-shell.ts';
import { useUiStore } from '../store/ui.ts';
import { useModules } from './use-modules.ts';
import { useAppearanceSync, usePersonalAppearance } from './use-personal-appearance.ts';
import { useLook } from './use-theme-effect.ts';
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
  const products = useMemo(() => productsOf(data), [data]);
  const { unreadCount } = useInbox();
  const signOut = useSignOut();
  const openPalette = useUiStore((state) => state.openPalette);
  const requestInvite = useUiStore((state) => state.requestInvite);
  useAppearanceSync(me);
  const personal = usePersonalAppearance();
  const look = useLook();
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

  return {
    me,
    workspace,
    /** The workspace's own logo once one is uploaded; Bemmoly stays beside it either way. */
    customLogo: customerLogo(workspace.name, workspace.appearance.logoKey),
    modules,
    unreadCount,
    creates,
    /** C and the New button: the first module's first create entry (Work's new issue). */
    primaryCreate: creates[0] ?? null,
    primary,
    /** Every product the person can use, for the switcher and the start page. */
    products,
    /** A product with its own app loads it; anything else is a route here. */
    openProduct: (path: string, product?: Product) =>
      product?.ownApp ? window.location.assign(path) : go(path),
    /** Mode is always the person's own: Light, Dark or Match system. */
    mode: { value: look.preference, set: personal.setMode },
    canInvite: me.can('workspace.roles.manage'),
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
