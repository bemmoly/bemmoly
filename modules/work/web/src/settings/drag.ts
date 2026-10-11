import { useState, type DragEvent, type KeyboardEvent } from 'react';

/*
 * Reordering by drag for the settings lists (columns, lanes, card fields),
 * with the native drag and drop the browser already has, and the same moves
 * from the keyboard on the grip: arrow keys step the item one place.
 */

export interface DragListOptions {
  /** Moves the item at `from` to `to`. */
  onMove: (from: number, to: number) => void;
  /** Read mode: nothing moves. */
  disabled?: boolean;
  /** Which arrow keys step the item: left and right for columns, up and down for rows. */
  axis?: 'x' | 'y';
}

/** The kind of drag in flight, so a status chip never lands in the column list. */
const MIME = 'application/x-bemmoly-settings';

export function useDragList({ onMove, disabled = false, axis = 'y' }: DragListOptions) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const back = axis === 'x' ? 'ArrowLeft' : 'ArrowUp';
  const forward = axis === 'x' ? 'ArrowRight' : 'ArrowDown';

  const item = (index: number) =>
    disabled
      ? {}
      : {
          onDragOver: (event: DragEvent) => {
            if (dragging === null) return;
            event.preventDefault();
            if (over !== index) setOver(index);
          },
          onDrop: (event: DragEvent) => {
            event.preventDefault();
            if (dragging !== null && dragging !== index) onMove(dragging, index);
            setDragging(null);
            setOver(null);
          },
        };

  const handle = (index: number, count: number) =>
    disabled
      ? {}
      : {
          draggable: true,
          onDragStart: (event: DragEvent) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData(MIME, String(index));
            setDragging(index);
          },
          onDragEnd: () => {
            setDragging(null);
            setOver(null);
          },
          onKeyDown: (event: KeyboardEvent) => {
            const step = event.key === back ? -1 : event.key === forward ? 1 : 0;
            const to = index + step;
            if (step === 0 || to < 0 || to >= count) return;
            event.preventDefault();
            onMove(index, to);
          },
        };

  return { item, handle, dragging, over };
}
