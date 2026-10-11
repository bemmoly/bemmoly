import type { KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { useState } from 'react';
import { cx } from '../../lib/cx.ts';
import { SHEET_MOTION } from '../../lib/motion.ts';
import { usePresence } from '../../lib/presence.ts';
import { useDialog } from '../../lib/use-dialog.ts';
import { IconButton } from '../button/icon-button.tsx';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  /** Names the panel for assistive tech, e.g. "PLT-204 details". */
  label: string;
  /** Left side of the header bar: the epic / type / key trail in the Board mock. */
  header?: ReactNode;
  /** Header actions before the close button (⤢ open full page, ··· more). */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * docked: the Board's issue panel, a 400px column beside the content (the mock).
   * overlay: the same panel over a scrim, for narrow screens and pages without room.
   */
  variant?: 'docked' | 'overlay';
  className?: string;
}

const WIDTH_KEY = 'bemmoly.drawer.width';
const MIN_WIDTH = 360;
const MAX_WIDTH = 960;
const DEFAULT_WIDTH = 400;

const clampWidth = (width: number) =>
  Math.round(Math.min(Math.max(width, MIN_WIDTH), Math.min(MAX_WIDTH, window.innerWidth - 320)));

function readWidth() {
  try {
    const saved = Number(window.localStorage.getItem(WIDTH_KEY));
    return saved ? clampWidth(saved) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function saveWidth(width: number) {
  try {
    window.localStorage.setItem(WIDTH_KEY, String(width));
  } catch {
    // Private windows and blocked storage keep the width for this visit only.
  }
}

/**
 * The docked panel's left edge: hover shows the accent rule, dragging widens or narrows the
 * panel, arrows step it by 16px. The width is remembered in this browser.
 */
function useDrawerWidth() {
  const [width, setWidth] = useState(readWidth);
  const commit = (next: number) => {
    const clamped = clampWidth(next);
    setWidth(clamped);
    saveWidth(clamped);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const startX = event.clientX;
    const startWidth = width;
    const move = (e: globalThis.PointerEvent) =>
      setWidth(clampWidth(startWidth + startX - e.clientX));
    const up = (e: globalThis.PointerEvent) => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      document.body.style.removeProperty('cursor');
      commit(startWidth + startX - e.clientX);
    };
    document.body.style.cursor = 'col-resize';
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowLeft' ? 16 : event.key === 'ArrowRight' ? -16 : 0;
    if (!step) return;
    event.preventDefault();
    commit(width + step);
  };
  return { width, onPointerDown, onKeyDown, reset: () => commit(DEFAULT_WIDTH) };
}

function Panel({
  header,
  actions,
  onClose,
  children,
}: Pick<DrawerProps, 'header' | 'actions' | 'onClose' | 'children'>) {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b border-line-2 px-4 py-3 text-13 text-tx-3">
        <div className="flex min-w-0 items-center gap-2">{header}</div>
        <div className="ml-auto flex items-center gap-1 font-semibold text-tx-2">
          {actions}
          <IconButton label="Close" icon="close" size="xs" onClick={onClose} />
        </div>
      </div>
      {/* relative: absolute content (sr-only text, hover tools) scrolls and clips here, not the page. */}
      <div className="relative flex min-h-0 flex-1 flex-col gap-4.5 overflow-auto px-5 pt-4 pb-6">
        {children}
      </div>
    </>
  );
}

/** Header bar 12px 16px over a br2 rule; body 16px 20px 24px with 18px between blocks. */
export function Drawer({
  open,
  onClose,
  label,
  header,
  actions,
  children,
  variant = 'docked',
  className,
}: DrawerProps) {
  const presence = usePresence(open);
  const resize = useDrawerWidth();
  const { ref, onBackdropClick } = useDialog(presence.mounted && variant === 'overlay', onClose);
  if (!presence.mounted) return null;
  const state = presence.leaving ? 'closed' : 'open';
  if (variant === 'overlay') {
    return (
      <dialog
        ref={ref}
        aria-label={label}
        onClick={onBackdropClick}
        data-state={state}
        className={cx(
          'm-0 ml-auto h-full max-h-full w-100 max-w-full flex-col border-0 border-l border-line bg-card p-0 text-13 text-tx open:flex',
          'backdrop:bg-scrim',
          SHEET_MOTION,
          className,
        )}
      >
        <Panel header={header} actions={actions} onClose={onClose}>
          {children}
        </Panel>
      </dialog>
    );
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };
  return (
    <aside
      aria-label={label}
      onKeyDown={onKeyDown}
      data-state={state}
      style={{ width: resize.width }}
      className={cx(
        'relative flex min-h-0 max-w-full shrink-0 flex-col border-l border-line bg-card text-13 text-tx',
        SHEET_MOTION,
        className,
      )}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panel"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={resize.width}
        tabIndex={0}
        onPointerDown={resize.onPointerDown}
        onKeyDown={resize.onKeyDown}
        onDoubleClick={resize.reset}
        className={cx(
          'absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none outline-0',
          'after:absolute after:inset-y-0 after:left-[3px] after:w-0.5 after:bg-acc after:opacity-0 after:transition-opacity',
          'hover:after:opacity-100 focus-visible:after:opacity-100 active:after:opacity-100',
        )}
      />
      <Panel header={header} actions={actions} onClose={onClose}>
        {children}
      </Panel>
    </aside>
  );
}

/** The issue title at the top of the drawer body: 18px semibold, 1.3 line height. */
export function DrawerTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2
      className={cx(
        'm-0 text-16 leading-title font-semibold tracking-brand text-pretty',
        className,
      )}
    >
      {children}
    </h2>
  );
}
