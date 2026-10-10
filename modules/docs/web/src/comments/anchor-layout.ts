import { useLayoutEffect, useState, type RefObject } from 'react';
import type { PageEditor } from './highlights.ts';

/*
 * Placing things level with the text they are about: comment markers beside the anchored
 * line, and thread cards in the docked rail beside their passage. Both live in the page's
 * scroll content, so a position measured once holds while the page scrolls.
 */

export interface Placed {
  id: string;
  /** Where it wants to sit: the top of its anchor, in the container's coordinates. */
  y: number;
  height: number;
}

/**
 * Tops for items in anchor order: each sits level with its anchor unless the one before
 * reaches past it, then just below that one. The focused item, when given, keeps its own
 * line and pushes the ones before it up instead, so the card being read is beside its text.
 */
export function stackTops(items: readonly Placed[], gap: number, pinned?: string | null): number[] {
  const tops = items.map((item) => item.y);
  const at = pinned ? items.findIndex((item) => item.id === pinned) : -1;
  const start = at >= 0 ? at : 0;
  for (let i = start + 1; i < items.length; i += 1) {
    const before = tops[i - 1]! + items[i - 1]!.height + gap;
    tops[i] = Math.max(items[i]!.y, before);
  }
  for (let i = start - 1; i >= 0; i -= 1) {
    const limit = tops[i + 1]! - gap - items[i]!.height;
    tops[i] = Math.max(0, Math.min(items[i]!.y, limit));
  }
  return tops;
}

/**
 * Each anchor's top relative to `container`, measured from the live editor. Measured again
 * when the anchors move, when the container resizes (the column reflows) and on `deps`.
 */
export function useAnchorOffsets(
  editor: PageEditor | null,
  anchors: ReadonlyMap<string, number>,
  container: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
): ReadonlyMap<string, number> {
  const [offsets, setOffsets] = useState<ReadonlyMap<string, number>>(new Map());
  useLayoutEffect(() => {
    const element = container.current;
    if (!editor || !element) return undefined;
    const measure = () => {
      if (editor.isDestroyed) return;
      const origin = element.getBoundingClientRect().top;
      const next = new Map<string, number>();
      for (const [id, from] of anchors) {
        try {
          next.set(id, editor.view.coordsAtPos(from).top - origin);
        } catch {
          // A position past the end while the document is changing: placed on the next pass.
        }
      }
      setOffsets(next);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(editor.view.dom);
    return () => observer.disconnect();
  }, [editor, anchors, container, ...deps]);
  return offsets;
}
