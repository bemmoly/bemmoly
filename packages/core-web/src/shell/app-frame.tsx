import { SHEET_MOTION, useDialog, usePresence } from '@bemmoly/ui';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { core } from '../i18n/catalog.ts';
import { useT } from '../i18n/use-t.ts';
import { FrameContext, type FrameState, type SidebarMode } from './frame-context.ts';

/** Below this width the sidebar folds to the rail by itself; below PHONE it becomes a sheet. */
export const NARROW = 1100;
export const PHONE = 768;

/** The docked sidebar's width: 240px unless the person drags its edge, within these bounds. */
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_MIN = 200;
export const SIDEBAR_MAX = 420;
const KEY_STEP = 16;

const clampWidth = (width: number) =>
  Math.round(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)));

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
  /** The person's own width for the docked sidebar, set by dragging its edge. */
  width?: number;
  onWidthChange?: (width: number) => void;
  /** The sidebar's contents; they read the mode they are drawn in from useFrame(). */
  sidebar: ReactNode;
  /** The phone's bottom bar. */
  bottomBar?: ReactNode;
  /** The tab title's context for pages that name none of their own. */
  workspaceName?: string;
  children: ReactNode;
}

const ASIDE = 'flex min-h-0 shrink-0 flex-col border-e border-line bg-side';

/**
 * The docked sidebar's edge: hover shows a line, dragging sets the width (kept when the drag
 * ends), arrow keys step it, and a double click goes back to 240px.
 */
function ResizeHandle({
  width,
  onLive,
  onCommit,
}: {
  width: number;
  onLive: (width: number | null) => void;
  onCommit: (width: number) => void;
}) {
  const t = useT(core);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t('core.frame.resize')}
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={width}
      tabIndex={0}
      data-dragging={dragging || undefined}
      className="group absolute inset-y-0 -end-1 z-10 w-2 cursor-col-resize touch-none outline-none select-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const handle = event.currentTarget;
        handle.setPointerCapture(event.pointerId);
        const startX = event.clientX;
        const rtl = getComputedStyle(handle).direction === 'rtl';
        let next = width;
        setDragging(true);
        const onMove = (move: PointerEvent) => {
          const delta = (move.clientX - startX) * (rtl ? -1 : 1);
          next = clampWidth(width + delta);
          onLive(next);
        };
        const onUp = () => {
          handle.removeEventListener('pointermove', onMove);
          handle.removeEventListener('pointerup', onUp);
          handle.removeEventListener('pointercancel', onUp);
          setDragging(false);
          onLive(null);
          if (next !== width) onCommit(next);
        };
        handle.addEventListener('pointermove', onMove);
        handle.addEventListener('pointerup', onUp);
        handle.addEventListener('pointercancel', onUp);
      }}
      onDoubleClick={() => onCommit(SIDEBAR_WIDTH)}
      onKeyDown={(event) => {
        const step =
          event.key === 'ArrowRight' ? KEY_STEP : event.key === 'ArrowLeft' ? -KEY_STEP : 0;
        if (step) {
          event.preventDefault();
          onCommit(clampWidth(width + step));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault();
          onCommit(event.key === 'Home' ? SIDEBAR_MIN : SIDEBAR_MAX);
        }
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-1/2 w-0.5 -translate-x-1/2 bg-acc-500 opacity-0 transition-opacity duration-fast group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[dragging]:opacity-100"
      />
    </div>
  );
}

/** The id the skip link lands on: the page, past the sidebar. */
export const MAIN_ID = 'main';

/**
 * The first stop on Tab: a link past the sidebar to the page (WCAG 2.4.1). Hidden until it has
 * focus, then drawn over the frame's top-left corner as a control.
 */
function SkipLink() {
  const t = useT(core);
  return (
    <a
      href={`#${MAIN_ID}`}
      onClick={(event) => {
        event.preventDefault();
        document.getElementById(MAIN_ID)?.focus();
      }}
      className="sr-only rounded-control bg-card px-3 py-1.5 text-13 font-medium text-tx shadow-e2 focus-ring focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50"
    >
      {t('core.frame.skip')}
    </a>
  );
}

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
  const t = useT(core);
  const presence = usePresence(open);
  const { ref, onBackdropClick } = useDialog(presence.mounted, onClose);
  if (!presence.mounted) return null;
  return (
    <dialog
      ref={ref}
      aria-label={t('core.frame.menu')}
      onClick={onBackdropClick}
      data-state={presence.leaving ? 'closed' : 'open'}
      className={`m-0 me-auto h-full max-h-full w-70 max-w-[85vw] flex-col border-0 border-e border-line bg-side p-0 text-13 text-tx open:flex [--slide-from:-24px] backdrop:bg-scrim ${SHEET_MOTION}`}
    >
      {children}
    </dialog>
  );
}

/**
 * The one frame every signed-in screen sits in (docs/design/premium/kit.js, `frame`): the
 * 240px sidebar (or the width the person dragged it to), then the page. The sidebar folds to the 56px rail on [ (remembered per
 * person) and by itself below 1100px, where [ unfolds it over the page instead of pushing the
 * page aside. Below 768px it becomes a sheet behind the header's menu button and a bottom bar
 * takes its place.
 */
export function AppFrame({
  pathname,
  navigate,
  collapsed,
  onCollapsedChange,
  width: savedWidth = SIDEBAR_WIDTH,
  onWidthChange,
  sidebar,
  bottomBar,
  workspaceName,
  children,
}: AppFrameProps) {
  const t = useT(core);
  const phone = useMatches(`(max-width: ${PHONE - 1}px)`);
  const narrow = useMatches(`(max-width: ${NARROW - 1}px)`);
  const [sheet, setSheet] = useState(false);
  const [peek, setPeek] = useState(false);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const width = liveWidth ?? clampWidth(savedWidth);
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
      ...(workspaceName ? { workspaceName } : {}),
      openSheet: () => setSheet(true),
      toggleSidebar: () => {
        if (phone) setSheet((open) => !open);
        else if (narrow) setPeek((open) => !open);
        else onCollapsedChange(!collapsed);
      },
    }),
    [phone, narrow, pathname, navigate, collapsed, onCollapsedChange, workspaceName],
  );
  const inMode = (mode: SidebarMode) => ({ ...base, mode });

  return (
    <FrameContext.Provider value={inMode(docked)}>
      <SkipLink />
      <div
        className="flex h-screen min-w-0 flex-col bg-canvas text-tx"
        data-sidebar={phone ? 'sheet' : docked}
      >
        <div className="relative flex min-h-0 flex-1">
          {phone ? null : (
            <aside
              aria-label={t('core.frame.sidebar')}
              className={`${ASIDE} relative ${docked === 'rail' ? 'w-14 items-center px-0 pt-3 pb-2.5' : 'px-2 pt-2.5 pb-2'}`}
              style={docked === 'rail' ? undefined : { width }}
            >
              {sidebar}
              {docked === 'full' && onWidthChange ? (
                <ResizeHandle width={width} onLive={setLiveWidth} onCommit={onWidthChange} />
              ) : null}
            </aside>
          )}
          {!phone && narrow && peek ? (
            <FrameContext.Provider value={inMode('full')}>
              <div
                ref={peekRef}
                className={`${ASIDE} absolute inset-y-0 start-0 z-30 w-60 px-2 pt-2.5 pb-2 shadow-e2 motion-safe:animate-slide-in [--slide-from:-24px]`}
              >
                {sidebar}
              </div>
            </FrameContext.Provider>
          ) : null}
          <main
            id={MAIN_ID}
            tabIndex={-1}
            className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
            data-testid="main"
          >
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
