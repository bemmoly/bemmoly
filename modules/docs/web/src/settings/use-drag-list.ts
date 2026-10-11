import { useState, type DragEvent, type KeyboardEvent } from 'react';

/*
 * Reordering the org templates: the browser's own drag and drop on the grip, and the same move
 * from the keyboard, where ↑ and ↓ on a focused grip step its row one place. The same
 * behaviour as Work's settings lists; a module cannot import another, so it lives here too.
 */

const MIME = 'application/x-bemmoly-templates';

export function useDragList({
  onMove,
  disabled = false,
}: {
  onMove: (from: number, to: number) => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

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
            const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
            const to = index + step;
            if (step === 0 || to < 0 || to >= count) return;
            event.preventDefault();
            event.stopPropagation();
            onMove(index, to);
          },
        };

  return { item, handle, dragging, over };
}

/** The ids with the one at `from` moved to `to`. */
export function moved<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
