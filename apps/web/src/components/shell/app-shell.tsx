import { ErrorBoundary } from '@bemmoly/core-web';
import { Outlet, useRouterState } from '@tanstack/react-router';
import { lazy, Suspense } from 'react';
import { useGlobalHotkeys, useRealtimeSync } from '../../hooks/use-shell-effects.ts';
import { useUiStore } from '../../store/ui.ts';
import { PageFailure } from '../page-failure.tsx';
import { AppTopBar } from './app-top-bar.tsx';
import { InboxDrawer } from './inbox-drawer.tsx';

const CommandPaletteHost = lazy(() => import('../command/command-palette-host.tsx'));

/** The authenticated frame: top bar, routed page, and the overlays the top bar opens. */
export function AppShell() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const paletteOpen = useUiStore((state) => state.paletteOpen);
  useRealtimeSync(true);
  useGlobalHotkeys();
  return (
    <div className="flex h-screen min-w-0 flex-col bg-bg text-tx">
      <AppTopBar />
      <main className="flex min-h-0 flex-1 flex-col overflow-auto" data-testid="main">
        <ErrorBoundary
          resetKey={pathname}
          fallback={(error, retry) => <PageFailure error={error} onRetry={retry} />}
        >
          <Outlet />
        </ErrorBoundary>
      </main>
      <InboxDrawer />
      {paletteOpen ? (
        <Suspense fallback={null}>
          <CommandPaletteHost />
        </Suspense>
      ) : null}
    </div>
  );
}
