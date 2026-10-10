import { SHEET_MOTION, useDialog, usePresence } from '@bemmoly/ui';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { FrameContext, type FrameState, type SidebarMode } from './frame-context.ts';

/** Below this width the sidebar folds to the rail by itself; below PHONE it becomes a sheet. */
export const NARROW = 1100;
export const PHONE = 768;

function useMatches(query: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', listener);
      return () => list.removeEventListener('change', listener);
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

export interface AppFrameProps {
  pathname: string;
  navigate: (path: string) => void;
  /** The person's own choice to keep the sidebar folded to the rail ([). */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** The sidebar's contents; they read the mode they are drawn in from useFrame(). */
  sidebar: ReactNode;
  /** The phone's bottom bar. */
  bottomBar?: ReactNode;
  children: ReactNode;
}

const ASIDE = 'flex min-h-0 shrink-0 flex-col border-r border-line bg-side';

/** The phone's sidebar: the full sidebar in a sheet from the left edge, over a scrim. */
function SidebarSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const presence = usePresence(open);
  const { ref, onBackdropClick } = useDialog(presence.mounted, onClose);
  if (!presence.mounted) return null;
  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClick={onBackdropClick}
      data-state={presence.leaving ? 'closed' : 'open'}
      className={`m-0 mr-auto h-full max-h-full w-70 max-w-[85vw] flex-col border-0 border-r border-line bg-side p-0 text-13 text-tx open:flex [--slide-from:-24px] backdrop:bg-scrim ${SHEET_MOTION}`}
    >
      {children}
    </dialog>
  );
}

/**
 * The one frame every signed-in screen sits in (docs/design/premium/kit.js, `frame`): the
 * 240px sidebar, then the page. The sidebar folds to the 56px rail on [ (remembered per
 * person) and by itself below 1100px, where [ unfolds it over the page instead of pushing the
 * page aside. Below 768px it becomes a sheet behind the header's menu button and a bottom bar
 * takes its place.
 */
export function AppFrame({
  pathname,
  navigate,
  collapsed,
  onCollapsedChange,
  sidebar,
  bottomBar,
  children,
}: AppFrameProps) {
  const phone = useMatches(`(max-width: ${PHONE - 1}px)`);
  const narrow = useMatches(`(max-width: ${NARROW - 1}px)`);
  const [sheet, setSheet] = useState(false);
  const [peek, setPeek] = useState(false);
  const peekRef = useRef<HTMLDivElement>(null);

  // Going somewhere closes the sheet and the unfolded sidebar.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setSheet(false);
    setPeek(false);
  }

  useEffect(() => {
    if (!peek) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!peekRef.current?.contains(event.target as Node)) setPeek(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPeek(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [peek]);

  const docked: SidebarMode = narrow || collapsed ? 'rail' : 'full';
  const base = useMemo<Omit<FrameState, 'mode'>>(
    () => ({
      phone,
      pathname,
      navigate,
      openSheet: () => setSheet(true),
      toggleSidebar: () => {
        if (phone) setSheet((open) => !open);
        else if (narrow) setPeek((open) => !open);
        else onCollapsedChange(!collapsed);
      },
    }),
    [phone, narrow, pathname, navigate, collapsed, onCollapsedChange],
  );
  const inMode = (mode: SidebarMode) => ({ ...base, mode });

  return (
    <FrameContext.Provider value={inMode(docked)}>
      <div
        className="flex h-screen min-w-0 flex-col bg-canvas text-tx"
        data-sidebar={phone ? 'sheet' : docked}
      >
        <div className="relative flex min-h-0 flex-1">
          {phone ? null : (
            <aside
              aria-label="Sidebar"
              className={`${ASIDE} ${docked === 'rail' ? 'w-14 items-center px-0 pt-3 pb-2.5' : 'w-60 px-2 pt-2.5 pb-2'}`}
            >
              {sidebar}
            </aside>
          )}
          {!phone && narrow && peek ? (
            <FrameContext.Provider value={inMode('full')}>
              <div
                ref={peekRef}
                className={`${ASIDE} absolute inset-y-0 left-0 z-30 w-60 px-2 pt-2.5 pb-2 shadow-e2 motion-safe:animate-slide-in [--slide-from:-24px]`}
              >
                {sidebar}
              </div>
            </FrameContext.Provider>
          ) : null}
          <main className="flex min-h-0 min-w-0 flex-1 flex-col" data-testid="main">
            {children}
          </main>
        </div>
        {phone ? bottomBar : null}
      </div>
      {phone ? (
        <FrameContext.Provider value={inMode('sheet')}>
          <SidebarSheet open={sheet} onClose={() => setSheet(false)}>
            <div className="flex min-h-0 flex-1 flex-col px-2 pt-2.5 pb-2">{sidebar}</div>
          </SidebarSheet>
        </FrameContext.Provider>
      ) : null}
    </FrameContext.Provider>
  );
}
