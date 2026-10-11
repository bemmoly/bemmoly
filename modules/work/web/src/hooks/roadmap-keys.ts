import type { RoadmapZoom } from '@bemmoly/module-work/shared';
import { useGlobalKeys, useShortcutHelp } from '@bemmoly/core-web';
import { useEffect, useRef, type RefObject } from 'react';

/*
 * The Roadmap's keys, listed in the ? overlay: T scrolls to today, W M Q zoom, F opens the
 * focused item's forecast, / focuses the filter, J K move between rows from anywhere on the
 * screen. None fires while typing, in a menu or dialog, or with Alt held (useGlobalKeys).
 * The bar's own arrows live on the bar.
 */

const HELP = {
  id: 'work.roadmap',
  label: 'Roadmap',
  keys: [
    { keys: 'Up Down', label: 'Move between rows (or J K)' },
    { keys: 'Enter', label: 'Open the epic, or a version’s forecast' },
    { keys: 'Left Right', label: 'Move the focused bar a day' },
    { keys: 'Shift+Left Shift+Right', label: 'Move the focused bar a week' },
    { keys: 'Alt+Left Alt+Right', label: 'Move the focused bar’s end' },
    { keys: 'F', label: 'Open the focused item’s forecast' },
    { keys: 'T', label: 'Scroll to today' },
    { keys: 'W', label: 'Zoom to weeks' },
    { keys: 'M', label: 'Zoom to months' },
    { keys: 'Q', label: 'Zoom to quarters' },
    { keys: '/', label: 'Filter the roadmap' },
  ],
} as const;

export interface RoadmapKeyActions {
  today: () => void;
  zoom: (zoom: RoadmapZoom) => void;
  forecast: (itemId: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
}

/** The item the keyboard is on: the focused name or bar, or nothing. */
const focusedItem = () =>
  (document.activeElement as HTMLElement | null)
    ?.closest?.('[data-item-id]')
    ?.getAttribute('data-item-id') ?? null;

/** Moves focus into the rows when J or K is pressed from outside them. */
function enterRows(scroller: HTMLElement | null, by: 1 | -1) {
  if (!scroller || scroller.contains(document.activeElement)) return;
  const names = [...scroller.querySelectorAll<HTMLElement>('[data-roadmap-cell="name"]')];
  (by === 1 ? names[0] : names.at(-1))?.focus();
}

export function useRoadmapKeys(actions: RoadmapKeyActions) {
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });
  useShortcutHelp(HELP);
  useGlobalKeys({
    t: () => latest.current.today(),
    w: () => latest.current.zoom('weeks'),
    m: () => latest.current.zoom('months'),
    q: () => latest.current.zoom('quarters'),
    f: () => {
      const id = focusedItem();
      if (id) latest.current.forecast(id);
    },
    '/': () => latest.current.searchRef.current?.focus(),
    j: () => enterRows(latest.current.scrollerRef.current, 1),
    k: () => enterRows(latest.current.scrollerRef.current, -1),
  });
}
