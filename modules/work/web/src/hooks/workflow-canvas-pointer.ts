import { useCallback, useRef, useState, type PointerEvent, type RefObject } from 'react';
import { CANVAS, NODE, type DraftStatus } from '../workflow/draft-model.ts';

/** Movement under this many pixels is a click, not a drag. */
const DRAG_THRESHOLD = 3;

type Point = { x: number; y: number };

export interface CanvasPointerOptions {
  canvas: RefObject<HTMLElement | null>;
  onSelect: (statusId: string) => void;
  onMove: (statusId: string, x: number, y: number) => void;
  onConnect: (fromStatusId: string, toStatusId: string) => void;
}

/** The status under a screen point, by the data-status-id every node carries. */
function statusAt(clientX: number, clientY: number): string | null {
  const element = document.elementFromPoint?.(clientX, clientY);
  return element?.closest<HTMLElement>('[data-status-id]')?.dataset['statusId'] ?? null;
}

/**
 * Pointer gestures on the canvas: dragging a node moves it, dragging from a
 * node's handle draws a transition to the node it is released on. Screen
 * pixels are turned into canvas units through the canvas's own box, so the
 * gestures hold at any width the canvas is drawn at.
 */
export function useCanvasPointer({ canvas, onSelect, onMove, onConnect }: CanvasPointerOptions) {
  const [connector, setConnector] = useState<{ from: Point; to: Point; fromId: string } | null>(
    null,
  );
  /** Set by a drag so the click that ends it does not also toggle the selection. */
  const dragged = useRef(false);

  const toUnits = useCallback(
    (clientX: number, clientY: number): Point => {
      const box = canvas.current?.getBoundingClientRect();
      if (!box || box.width === 0 || box.height === 0) return { x: 0, y: 0 };
      return {
        x: ((clientX - box.left) / box.width) * CANVAS.width,
        y: ((clientY - box.top) / box.height) * CANVAS.height,
      };
    },
    [canvas],
  );

  const track = useCallback(
    (
      onMoveEvent: (event: globalThis.PointerEvent) => void,
      onUp: (event: globalThis.PointerEvent) => void,
    ) => {
      const up = (event: globalThis.PointerEvent) => {
        window.removeEventListener('pointermove', onMoveEvent);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        onUp(event);
      };
      window.addEventListener('pointermove', onMoveEvent);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    },
    [],
  );

  const startNodeDrag = useCallback(
    (event: PointerEvent<HTMLElement>, status: DraftStatus) => {
      if (event.button !== 0) return;
      dragged.current = false;
      const startX = event.clientX;
      const startY = event.clientY;
      const origin = toUnits(startX, startY);
      const at = { x: status.x ?? 0, y: status.y ?? 0 };
      track(
        (move) => {
          if (
            !dragged.current &&
            Math.hypot(move.clientX - startX, move.clientY - startY) < DRAG_THRESHOLD
          )
            return;
          if (!dragged.current) onSelect(status.id);
          dragged.current = true;
          const now = toUnits(move.clientX, move.clientY);
          onMove(status.id, at.x + now.x - origin.x, at.y + now.y - origin.y);
        },
        () => undefined,
      );
    },
    [onMove, onSelect, toUnits, track],
  );

  const startConnect = useCallback(
    (event: PointerEvent<HTMLElement>, status: DraftStatus) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const from = { x: (status.x ?? 0) + NODE.halfWidth, y: status.y ?? 0 };
      setConnector({ from, to: from, fromId: status.id });
      track(
        (move) =>
          setConnector({ from, to: toUnits(move.clientX, move.clientY), fromId: status.id }),
        (up) => {
          setConnector(null);
          const target = statusAt(up.clientX, up.clientY);
          if (target && target !== status.id) onConnect(status.id, target);
        },
      );
    },
    [onConnect, toUnits, track],
  );

  /** True once for the click that ends a drag; the node's onClick asks before selecting. */
  const consumeDrag = useCallback(() => {
    const was = dragged.current;
    dragged.current = false;
    return was;
  }, []);

  return { connector, startNodeDrag, startConnect, consumeDrag };
}
