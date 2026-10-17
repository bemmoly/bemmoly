import { FrameContext, setPreferenceOwner, useT } from '@bemmoly/core-web';
import { Outlet, useRouter } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';
import { useBrowserPath } from '../hooks/use-browser-path.ts';
import { useMe } from '../hooks/use-me.ts';
import { useMode } from '../hooks/use-mode.ts';
import { useWorkspaceTheme } from '../hooks/use-workspace-theme.ts';
import { pipelinesText } from '../i18n/catalog.ts';
import { NoAccessScreen } from '../screens/no-access.tsx';
import { CommandMenu } from './command-menu.tsx';
import { KeysDialog } from './keys-dialog.tsx';
import { PhoneBar } from './phone-bar.tsx';
import { Rail } from './rail.tsx';
import { TopBar } from './top-bar.tsx';
import { useShellKeys } from './use-shell-keys.ts';

/**
 * Pipelines' own frame (ADR 0037): the 72px rail, the 48px top bar, one scrolling content
 * area, and on a phone a bottom bar in place of the rail. Built for scanning live information
 * beside an editor, so it is dark until the person picks light.
 */
export function PipelinesShell() {
  const t = useT(pipelinesText);
  const router = useRouter();
  const pathname = useBrowserPath();
  const { data: me } = useMe();
  const appearance = useMode();
  const { mode, toggle } = appearance;
  useWorkspaceTheme(mode);
  useShellKeys(toggle);
  useEffect(() => setPreferenceOwner(me?.user.id ?? null), [me?.user.id]);
  const frame = useMemo(
    () => ({
      mode: 'rail' as const,
      phone: false,
      pathname,
      navigate: (path: string) => router.history.push(path),
      openSheet: () => undefined,
      toggleSidebar: () => undefined,
    }),
    [pathname, router],
  );
  return (
    <FrameContext.Provider value={frame}>
      <div className="flex h-dvh min-h-0 bg-canvas text-tx">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-control focus:bg-card focus:px-3 focus:py-2 focus:shadow-e2"
        >
          {t('pipelines.shell.skip')}
        </a>
        <Rail appearance={appearance} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main id="content" tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-0">
            {me && !me.modules.includes('pipelines') ? <NoAccessScreen /> : <Outlet />}
          </main>
          <PhoneBar />
        </div>
        <CommandMenu onToggleMode={toggle} />
        <KeysDialog />
      </div>
    </FrameContext.Provider>
  );
}
