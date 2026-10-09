import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type Ref,
} from 'react';

/** A part of the canvas in its own units, e.g. the box around every status. */
export interface CanvasRegion {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The space kept between a framed region or a revealed element and the viewport's edge. */
const MARGIN = 24;

/** What a press must not start a pan on: the nodes, labels and anything else that acts. */
const CONTROLS = 'button, a, input, select, textarea, [role="button"]';

/** Marks the scrolling box, so a node or label inside it can be brought into view. */
const VIEWPORT = '[data-canvas-viewport]';

const clamp = (value: number, max: number) => Math.max(0, Math.min(value, Math.max(0, max)));

/** One axis of a frame: centred when it fits with its margins, its start edge first when not. */
function frameAxis(start: number, end: number, view: number, surface: number) {
  const fits = end - start + 2 * MARGIN <= view;
  return clamp(fits ? (start + end - view) / 2 : start - MARGIN, surface - view);
}

/**
 * The scroll offsets that frame a region: the canvas is drawn at its own size,
 * so a workflow wider than the viewport opens on its first column rather than
 * shrinking its type below the mock's.
 */
export function frameScroll(
  region: CanvasRegion,
  units: { width: number; height: number },
  box: { viewWidth: number; viewHeight: number; surfaceWidth: number; surfaceHeight: number },
) {
  const sx = box.surfaceWidth / units.width;
  const sy = box.surfaceHeight / units.height;
  return {
    left: frameAxis(region.left * sx, region.right * sx, box.viewWidth, box.surfaceWidth),
    top: frameAxis(region.top * sy, region.bottom * sy, box.viewHeight, box.surfaceHeight),
  };
}

/** Scrolls the canvas holding an element just far enough to show it whole, and nothing else. */
export function revealInCanvas(element: Element) {
  const viewport = element.closest<HTMLElement>(VIEWPORT);
  if (!viewport) return;
  const view = viewport.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  const left = view.left + viewport.clientLeft;
  const top = view.top + viewport.clientTop;
  const shift = (start: number, end: number, from: number, size: number) =>
    start < from + MARGIN
      ? start - from - MARGIN
      : end > from + size - MARGIN
        ? Math.min(end - from - size + MARGIN, start - from - MARGIN)
        : 0;
  viewport.scrollLeft += shift(box.left, box.right, left, viewport.clientWidth);
  viewport.scrollTop += shift(box.top, box.bottom, top, viewport.clientHeight);
}

const overflows = (el: HTMLElement) =>
  el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;

export interface CanvasViewportOptions {
  /** The canvas units the surface is drawn in. */
  width: number;
  height: number;
  /** The region to bring into view when the canvas first opens. */
  frame: CanvasRegion | undefined;
  /** The caller's ref to the drawn surface, which it measures for pointer gestures. */
  surfaceRef: Ref<HTMLDivElement> | undefined;
}

/**
 * The canvas's own scrolling: wheel and trackpad scroll it natively, a press
 * on empty canvas drags it around, and it opens framed on its content. The
 * page never scrolls sideways for it.
 */
export function useCanvasViewport({ width, height, frame, surfaceRef }: CanvasViewportOptions) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const drawnRef = useRef<HTMLDivElement>(null);
  const [pannable, setPannable] = useState(false);
  const [panning, setPanning] = useState(false);
  const framed = useRef(false);
  const stop = useRef<(() => void) | null>(null);

  useImperativeHandle(surfaceRef, () => drawnRef.current as HTMLDivElement, []);

  useLayoutEffect(() => {
    const view = viewportRef.current;
    const drawn = drawnRef.current;
    if (framed.current || !frame || !view || !drawn || view.clientWidth === 0) return;
    framed.current = true;
    const at = frameScroll(
      frame,
      { width, height },
      {
        viewWidth: view.clientWidth,
        viewHeight: view.clientHeight,
        surfaceWidth: drawn.offsetWidth,
        surfaceHeight: drawn.offsetHeight,
      },
    );
    view.scrollLeft = at.left;
    view.scrollTop = at.top;
  }, [frame, width, height]);

  useEffect(() => {
    const view = viewportRef.current;
    if (!view) return;
    const measure = () => setPannable(overflows(view));
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(view);
    if (drawnRef.current) observer?.observe(drawnRef.current);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const view = event.currentTarget;
    const target = event.target as Element;
    if (event.button !== 0 || event.pointerType === 'touch' || target.closest(CONTROLS)) return;
    if (!overflows(view)) return;
    event.preventDefault();
    const start = {
      x: event.clientX,
      y: event.clientY,
      left: view.scrollLeft,
      top: view.scrollTop,
    };
    const move = (next: globalThis.PointerEvent) => {
      view.scrollLeft = start.left - (next.clientX - start.x);
      view.scrollTop = start.top - (next.clientY - start.y);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      stop.current = null;
      setPanning(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stop.current = end;
    setPanning(true);
  }, []);

  return { viewportRef, surfaceRef: drawnRef, pannable, panning, onPointerDown };
}
