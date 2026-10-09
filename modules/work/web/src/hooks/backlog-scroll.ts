import type { ContainerLayout } from './backlog-slots.ts';

/*
 * Rows are virtualised, so the row the keyboard moves to may not be in the
 * document yet. Each container's list registers how to scroll one of its
 * rows into view; focus waits a frame for the row to mount.
 */

type Scroller = (index: number) => void;

const scrollers = new Map<string, Scroller>();

export function registerScroller(containerId: string, scroller: Scroller): () => void {
  scrollers.set(containerId, scroller);
  return () => {
    if (scrollers.get(containerId) === scroller) scrollers.delete(containerId);
  };
}

const rowElement = (id: string) =>
  document.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`);

/** Scrolls the row into view and focuses it once it is mounted. */
export function revealRow(layout: readonly ContainerLayout[], id: string, focus = true): void {
  const container = layout.find((entry) => entry.visibleIds.includes(id));
  if (!container) return;
  const present = rowElement(id);
  if (present) {
    present.scrollIntoView({ block: 'nearest' });
  } else {
    scrollers.get(container.id)?.(container.visibleIds.indexOf(id));
  }
  if (!focus) return;
  const attempt = (tries: number) => {
    const row = rowElement(id);
    if (row) row.focus({ preventScroll: Boolean(present) });
    else if (tries > 0) requestAnimationFrame(() => attempt(tries - 1));
  };
  attempt(3);
}
