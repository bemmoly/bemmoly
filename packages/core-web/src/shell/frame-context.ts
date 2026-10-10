import { createContext, useContext, type MouseEvent } from 'react';
import { navigateInApp } from '../modules/navigation.ts';

/**
 * full: the 240px sidebar. rail: the 56px rail of icons and tiles. sheet: the full sidebar
 * inside the phone's sheet, which closes as soon as the person goes somewhere.
 */
export type SidebarMode = 'full' | 'rail' | 'sheet';

export interface FrameState {
  mode: SidebarMode;
  /** Below 768px: the sidebar is a sheet, the header shows the menu button and a bottom bar. */
  phone: boolean;
  pathname: string;
  /** In-app navigation through the shell's router. */
  navigate: (path: string) => void;
  /** Opens the phone's sidebar sheet. */
  openSheet: () => void;
  /** Folds or unfolds the sidebar, as [ does. */
  toggleSidebar: () => void;
}

export const FrameContext = createContext<FrameState>({
  mode: 'full',
  phone: false,
  pathname: '/',
  navigate: navigateInApp,
  openSheet: () => undefined,
  toggleSidebar: () => undefined,
});

export function useFrame(): FrameState {
  return useContext(FrameContext);
}

/** The path is this item's or inside it; `exact` items (Home) only match themselves. */
export function isActivePath(pathname: string, path: string, exact = false): boolean {
  const bare = path.split(/[?#]/)[0] ?? path;
  if (exact || bare === '/') return pathname === bare;
  return pathname === bare || pathname.startsWith(`${bare}/`);
}

const plainClick = (event: MouseEvent<HTMLElement>) =>
  !event.defaultPrevented &&
  event.button === 0 &&
  !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

/**
 * Props for a frame link: a real href, so ⌘-click and middle-click open a new tab, and a plain
 * click that moves through the router without a reload.
 */
export function useFrameLink(path: string, after?: () => void) {
  const { navigate } = useFrame();
  return {
    href: path,
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      navigate(path);
      after?.();
    },
  };
}
