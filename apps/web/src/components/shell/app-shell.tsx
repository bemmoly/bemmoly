import {
  AppFrame,
  BottomBar,
  EntityRenderersProvider,
  ErrorBoundary,
  knownIcon,
  useFrame,
  useGlobalKeys,
  usePreference,
} from '@bemmoly/core-web';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react';
import { useRealtimeSync } from '../../hooks/use-shell-effects.ts';
import { useShell, type Shell } from '../../hooks/use-shell.ts';
import { ENTITY_RENDERERS } from '../../lib/entity-renderers.ts';
import { useUiStore } from '../../store/ui.ts';
import { PageFailure } from '../page-failure.tsx';
import { AboutDialog } from './about-dialog.tsx';
import { AppSidebar } from './app-sidebar.tsx';
import { CreateHost } from './create-host.tsx';
import { NewButton } from './new-button.tsx';
import { SettingsSidebar } from './settings-sidebar.tsx';
import { ShortcutsOverlay, shellShortcuts } from './shortcuts-overlay.tsx';

const CommandPaletteHost = lazy(() => import('../command/command-palette-host.tsx'));

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
  const area = shell.modules[0];
  const items = [
    { id: 'home', label: 'Home', icon: 'home' as const, path: '/', exact: true },
    {
      id: 'inbox',
      label: 'Inbox',
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
  const setAppPath = useUiStore((state) => state.setAppPath);
  const [collapsed, setCollapsed] = usePreference('sidebar.collapsed', false);
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
      sidebar={settings ? <SettingsSidebar shell={shell} /> : <AppSidebar shell={shell} />}
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
      <ShortcutsOverlay groups={shortcuts} />
      <AboutDialog workspaceName={shell.workspace.name} />
      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPaletteHost />
        </Suspense>
      ) : null}
    </AppFrame>
  );
}
