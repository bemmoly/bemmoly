import { useBoardDragStore } from '../hooks/board-drag-store.ts';
import type { DropTarget } from '../hooks/board-drag.ts';

/*
 * Which card was just set down, so it can settle where it lands. Presentation only: it reads
 * the drag store's own transitions and never writes to it. A drop re-renders the card in its
 * new cell as a new element, which asks here when it mounts.
 */

const WINDOW_MS = 1000;

let landed: { issueId: string; from: DropTarget; at: number } | null = null;

useBoardDragStore.subscribe((state, previous) => {
  if (previous.carrying && !state.carrying) {
    const { issueId, from } = previous.carrying;
    landed = { issueId, from, at: performance.now() };
  }
});

/** True once for a card that has just been dropped somewhere other than where it started. */
export function takeLanding(issueId: string, place: DropTarget): boolean {
  if (!landed || landed.issueId !== issueId || performance.now() - landed.at > WINDOW_MS)
    return false;
  const { from } = landed;
  const moved =
    from.laneId !== place.laneId || from.columnId !== place.columnId || from.index !== place.index;
  if (moved) landed = null;
  return moved;
}

/** Plays the design system's settle animation on the element once. */
export function settle(element: HTMLElement): void {
  element.dataset['settle'] = '';
  element.addEventListener('animationend', () => delete element.dataset['settle'], { once: true });
}
