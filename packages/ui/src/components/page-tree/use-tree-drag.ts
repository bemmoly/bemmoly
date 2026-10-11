import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import {
  moveForDrop,
  zoneAt,
  type DropZone,
  type PageTreeItem,
  type PageTreeMove,
} from './tree-model.ts';

/** The drag payload type, so a drop from outside the tree (a file, a link) is ignored. */
export const PAGE_DRAG_TYPE = 'application/x-bemmoly-page';

/** How long a dragged page hovers over a closed page before it opens. */
const OPEN_AFTER_MS = 600;

interface DragState {
  dragId: string;
  overId: string | null;
  zone: DropZone | null;
}

/**
 * Native drag and drop for the tree: the row under the pointer shows a line above or below
 * it, or a ring when the drop would nest; a closed page held over opens. A drop the model
 * refuses (onto itself, into its own subtree, where it already is) shows nothing.
 */
export function useTreeDrag(
  items: readonly PageTreeItem[],
  onMove: ((move: PageTreeMove) => void) | undefined,
  onExpand: (item: PageTreeItem) => void,
) {
  const [state, setState] = useState<DragState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clearTimer, []);

  const start = useCallback(
    (item: PageTreeItem, event: DragEvent<HTMLElement>) => {
      if (!onMove) return;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(PAGE_DRAG_TYPE, item.id);
      event.dataTransfer.setData('text/plain', item.title || 'Untitled');
      setState({ dragId: item.id, overId: null, zone: null });
    },
    [onMove],
  );

  const over = useCallback(
    (item: PageTreeItem, event: DragEvent<HTMLElement>) => {
      if (!state) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const zone = zoneAt(event.clientY - rect.top, rect.height);
      const move = moveForDrop(items, state.dragId, item.id, zone);
      if (!move) {
        if (state.overId !== null) setState({ ...state, overId: null, zone: null });
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (state.overId === item.id && state.zone === zone) return;
      clearTimer();
      if (zone === 'inside' && item.hasChildren && !item.expanded) {
        timer.current = setTimeout(() => onExpand(item), OPEN_AFTER_MS);
      }
      setState({ ...state, overId: item.id, zone });
    },
    [items, state, onExpand],
  );

  const end = useCallback(() => {
    clearTimer();
    setState(null);
  }, []);

  const drop = useCallback(
    (item: PageTreeItem, event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      const zone = state?.overId === item.id ? state.zone : null;
      const move = state && zone ? moveForDrop(items, state.dragId, item.id, zone) : null;
      end();
      if (move) onMove?.(move);
    },
    [items, state, end, onMove],
  );

  return {
    dragId: state?.dragId ?? null,
    zoneFor: (id: string): DropZone | null => (state?.overId === id ? state.zone : null),
    start,
    over,
    end,
    drop,
  };
}
