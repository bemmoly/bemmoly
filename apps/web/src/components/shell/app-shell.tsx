import {
  AppFrame,
  BottomBar,
  EntityRenderersProvider,
  ErrorBoundary,
  knownIcon,
  useFrame,
  useGlobalKeys,
  SIDEBAR_WIDTH,
  usePreference,
  useT,
} from '@bemmoly/core-web';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtimeSync } from '../../hooks/use-shell-effects.ts';
import { useShell, type Shell } from '../../hooks/use-shell.ts';
import { shellText } from '../../i18n/catalogs.ts';
import { ENTITY_RENDERERS } from '../../lib/entity-renderers.ts';
import { useUiStore } from '../../store/ui.ts';
import { PageFailure } from '../page-failure.tsx';
import { AppSidebar } from './app-sidebar.tsx';
import { CreateHost } from './create-host.tsx';
import { NewButton } from './new-button.tsx';
import { shellShortcuts } from './shell-shortcuts.ts';

const CommandPaletteHost = lazy(() => import('../command/command-palette-host.tsx'));
const PlanFollower = lazy(() => import('../command/plan-follower.tsx'));
const ShortcutsOverlay = lazy(async () => ({
  default: (await import('./shortcuts-overlay.tsx')).ShortcutsOverlay,
}));
// Settings' sidebar arrives with the settings pages, which load its chunk anyway.
const SettingsSidebar = lazy(async () => ({
  default: (await import('./settings-sidebar.tsx')).SettingsSidebar,
}));
const AboutDialog = lazy(async () => ({
  default: (await import('./about-dialog.tsx')).AboutDialog,
}));

/** True from the first time `open` is, so a dialog loads on first use and then stays to close. */
function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened;
}

/** The frame's keys: they need its sidebar toggle, so they live inside it. */
function ShellKeys({ shell }: { shell: Shell }) {
  const { toggleSidebar, navigate } = useFrame();
  const togglePalette = useUiStore((state) => state.togglePalette);
  const openPalette = useUiStore((state) => state.openPalette);
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen);
  const chords = Object.fromEntries(
    shell.modules
      .flatMap((module) => module.navigation)
      .filter((entry) => entry.keys)
      .map((entry) => [entry.keys?.toLowerCase() ?? '', () => navigate(entry.path)]),
  );
  useGlobalKeys({
    'mod+k': togglePalette,
    '/': () => openPalette(),
    '?': () => setShortcutsOpen(true),
    '[': toggleSidebar,
    'g h': () => navigate('/'),
    'g i': () => navigate('/inbox'),
    ...chords,
    ...(shell.primaryCreate ? { c: shell.primaryCreate.open } : {}),
  });
  return null;
}

/** The phone's bottom bar: Home, Inbox, New, what modules add (My issues) and the first area. */
function PhoneBar({ shell }: { shell: Shell }) {
  const t = useT(shellText);
  const area = shell.modules[0];
  const items = [
    { id: 'home', label: t('shell.nav.home'), icon: 'home' as const, path: '/', exact: true },
    {
      id: 'inbox',
      label: t('shell.nav.inbox'),
      icon: 'inbox' as const,
      path: '/inbox',
      ...(shell.unreadCount > 0 ? { pill: shell.unreadCount } : {}),
    },
    ...shell.primary.slice(0, 1).map((link) => ({
      id: link.id,
      label: link.label,
      icon: knownIcon(link.icon) ?? 'me',
      path: link.path,
    })),
    ...(area
      ? [
          {
            id: area.id,
            label: area.navigation.find((entry) => entry.placement === 'top')?.label ?? area.id,
            icon: knownIcon(area.icon) ?? 'modules',
            path: area.navigation.find((entry) => entry.placement === 'top')?.path ?? `/${area.id}`,
          },
        ]
      : []),
  ];
  return <BottomBar items={items} primary={<NewButton shell={shell} size={42} />} />;
}

/**
 * Everything behind sign-in: the one frame (sidebar, then the routed page), with the palette,
 * the shortcuts overlay and create dialogs over it. On /settings the same sidebar shows the
 * settings pages. Every page may draw the records of any module the person can open (the
 * Inbox shows Work's issue, Docs embeds it).
 */
export function AppShell() {
  const shell = useShell();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const paletteOpen = useUiStore((state) => state.paletteOpen);
  const aiPlanId = useUiStore((state) => state.aiPlanId);
  const setAppPath = useUiStore((state) => state.setAppPath);
  const shortcutsOpened = useOpenedOnce(useUiStore((state) => state.shortcutsOpen));
  const aboutOpened = useOpenedOnce(useUiStore((state) => state.aboutOpen));
  const [collapsed, setCollapsed] = usePreference('sidebar.collapsed', false);
  const [sidebarWidth, setSidebarWidth] = usePreference('sidebar.width', SIDEBAR_WIDTH);
  const settings = pathname === '/settings' || pathname.startsWith('/settings/');
  const go = useCallback((path: string) => void navigate({ to: path }), [navigate]);
  useRealtimeSync(true);

  useEffect(() => {
    if (!settings) setAppPath(`${pathname}${window.location.search}`);
  }, [settings, pathname, setAppPath]);

  const shortcuts = useMemo(
    () =>
      shellShortcuts({
        createLabel: shell.primaryCreate?.label.toLowerCase() ?? null,
        chords: shell.modules.flatMap((module) =>
          module.navigation.flatMap((entry) =>
            entry.keys ? [{ keys: entry.keys, label: entry.label }] : [],
          ),
        ),
      }),
    [shell.primaryCreate, shell.modules],
  );

  return (
    <AppFrame
      pathname={pathname}
      navigate={go}
      collapsed={collapsed}
      onCollapsedChange={setCollapsed}
      width={sidebarWidth}
      onWidthChange={setSidebarWidth}
      sidebar={
        settings ? (
          <Suspense fallback={null}>
            <SettingsSidebar shell={shell} />
          </Suspense>
        ) : (
          <AppSidebar shell={shell} />
        )
      }
      bottomBar={<PhoneBar shell={shell} />}
      workspaceName={shell.workspace.name}
    >
      <ShellKeys shell={shell} />
      <ErrorBoundary
        resetKey={pathname}
        fallback={(error, retry) => <PageFailure framed error={error} onRetry={retry} />}
      >
        <EntityRenderersProvider
          registry={ENTITY_RENDERERS}
          moduleIds={shell.modules.map((module) => module.id)}
        >
          <Outlet />
        </EntityRenderersProvider>
      </ErrorBoundary>
      <CreateHost />
      {shortcutsOpened ? (
        <Suspense fallback={null}>
          <ShortcutsOverlay groups={shortcuts} />
        </Suspense>
      ) : null}
      {aboutOpened ? (
        <Suspense fallback={null}>
          <AboutDialog workspaceName={shell.workspace.name} />
        </Suspense>
      ) : null}
      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPaletteHost />
        </Suspense>
      ) : aiPlanId ? (
        <Suspense fallback={null}>
          <PlanFollower id={aiPlanId} />
        </Suspense>
      ) : null}
    </AppFrame>
  );
}
