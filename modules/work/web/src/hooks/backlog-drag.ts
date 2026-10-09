import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { DropTarget } from '../backlog/move.ts';
import { draggedIds } from './backlog-selection.ts';
import { rowAfter, screenOrder, type ContainerLayout } from './backlog-slots.ts';
import { useBacklogUi } from './backlog-store.ts';

export interface PointerDragOptions {
  /** The scrolling pane; the drag scrolls it when the pointer nears an edge. */
  scrollRef: RefObject<HTMLElement | null>;
  /** The floating chip under the pointer; moved by style, never by a render. */
  previewRef: RefObject<HTMLElement | null>;
  layout: () => readonly ContainerLayout[];
  onDrop: (ids: readonly string[], target: DropTarget) => void;
}

/** Pixels the pointer travels before a press becomes a drag, so clicks stay clicks. */
const THRESHOLD = 4;
/** The band at the pane's top and bottom edge that scrolls it, and the top speed. */
const EDGE = 56;
const SPEED = 18;

/**
 * Where a point lands: above a row's middle is above that row, below it is
 * above the next one; a container's header is its top, anything else in it
 * its end. Rows, headers and containers say who they are in data attributes.
 */
export function hitTest(
  x: number,
  y: number,
  layout: readonly ContainerLayout[],
): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  if (!element) return null;
  const row = element.closest<HTMLElement>('[data-row-id]');
  const rowId = row?.dataset['rowId'];
  const rowContainer = row?.dataset['containerId'];
  if (row && rowId && rowContainer) {
    const box = row.getBoundingClientRect();
    if (y < box.top + box.height / 2) return { containerId: rowContainer, beforeId: rowId };
    return { containerId: rowContainer, beforeId: rowAfter(layout, rowContainer, rowId) };
  }
  const section = element.closest<HTMLElement>('[data-container-id]');
  const containerId = section?.dataset['containerId'];
  if (!containerId) return null;
  if (element.closest('[data-drop-top]')) {
    const container = layout.find((entry) => entry.id === containerId);
    return { containerId, beforeId: container?.open ? (container.visibleIds[0] ?? null) : null };
  }
  return { containerId, beforeId: null };
}

/**
 * Mouse and pen drags of rows. A press on a row becomes a drag after a few
 * pixels; the selection travels with a selected row. The drop place follows
 * the pointer, the pane scrolls near its edges, Escape cancels and the click
 * that ends a drag is swallowed so it does not change the selection.
 */
export function usePointerDrag(options: PointerDragOptions) {
  const latest = useRef(options);
  latest.current = options;
  const swallowClick = useRef(false);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0 || event.pointerType === 'touch') return;
    if ((event.target as Element).closest('button, a, input, textarea, select')) return;
    const start = { x: event.clientX, y: event.clientY };
    const last = { ...start };
    let started = false;
    let frame = 0;

    const place = () => {
      const target = hitTest(last.x, last.y, latest.current.layout());
      if (target) useBacklogUi.getState().setTarget(target);
      const preview = latest.current.previewRef.current;
      if (preview) preview.style.transform = `translate(${last.x + 12}px, ${last.y + 8}px)`;
    };

    const scroll = () => {
      const pane = latest.current.scrollRef.current;
      if (pane) {
        const box = pane.getBoundingClientRect();
        const up = box.top + EDGE - last.y;
        const down = last.y - (box.bottom - EDGE);
        const delta = up > 0 ? -Math.min(SPEED, up / 2) : down > 0 ? Math.min(SPEED, down / 2) : 0;
        if (delta !== 0) {
          pane.scrollTop += delta;
          place();
        }
      }
      frame = requestAnimationFrame(scroll);
    };

    const begin = () => {
      started = true;
      const ui = useBacklogUi.getState();
      const order = screenOrder(latest.current.layout());
      const ids = draggedIds(ui.selection, id).sort((a, b) => order.indexOf(a) - order.indexOf(b));
      if (!ui.selection.ids.includes(id)) ui.setSelection({ ids: [id], anchor: id });
      ui.startDrag(ids, 'pointer', null);
      frame = requestAnimationFrame(scroll);
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey, true);
    };

    function onMove(move: PointerEvent) {
      last.x = move.clientX;
      last.y = move.clientY;
      if (!started) {
        if (Math.hypot(last.x - start.x, last.y - start.y) < THRESHOLD) return;
        begin();
      }
      move.preventDefault();
      place();
    }

    function onUp() {
      stop();
      if (!started) return;
      const { drag, endDrag } = useBacklogUi.getState();
      endDrag();
      if (drag?.target) latest.current.onDrop(drag.ids, drag.target);
      swallowClick.current = true;
      setTimeout(() => {
        swallowClick.current = false;
      }, 0);
    }

    function onCancel() {
      stop();
      if (started) useBacklogUi.getState().endDrag();
    }

    function onKey(key: KeyboardEvent) {
      if (key.key !== 'Escape') return;
      key.preventDefault();
      key.stopPropagation();
      onCancel();
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey, true);
  }, []);

  /** True once for the click that ends a drag. */
  const consumeClick = useCallback(() => {
    const swallow = swallowClick.current;
    swallowClick.current = false;
    return swallow;
  }, []);

  return { onPointerDown, consumeClick };
}
