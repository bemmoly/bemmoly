import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { stackTops, useAnchorOffsets } from './anchor-layout.ts';
import type { PageEditor } from './highlights.ts';
import type { CommentThread } from './use-comments.ts';

export interface AlignedThreadsProps {
  editor: PageEditor | null;
  threads: readonly CommentThread[];
  anchors: ReadonlyMap<string, number>;
  /** The thread in focus keeps its line; the others make room around it. */
  active: string | null;
  renderThread: (thread: CommentThread) => ReactNode;
}

const GAP = 10;

/**
 * Thread cards in the docked margin, each level with its highlighted passage, as the review
 * draws them. The margin scrolls with the page, so a card stays beside its text. Cards that
 * would overlap stack, and the focused one is never pushed away from its passage.
 */
export function AlignedThreads({
  editor,
  threads,
  anchors,
  active,
  renderThread,
}: AlignedThreadsProps) {
  const box = useRef<HTMLDivElement>(null);
  const offsets = useAnchorOffsets(editor, anchors, box, [threads]);
  const [heights, setHeights] = useState<ReadonlyMap<string, number>>(new Map());

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return undefined;
    const measure = () => {
      const next = new Map<string, number>();
      for (const card of element.querySelectorAll<HTMLElement>('[data-slot-thread]')) {
        next.set(card.dataset['slotThread']!, card.offsetHeight);
      }
      setHeights((before) =>
        before.size === next.size && [...next].every(([id, h]) => before.get(id) === h)
          ? before
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    for (const card of element.querySelectorAll('[data-slot-thread]')) observer.observe(card);
    return () => observer.disconnect();
  }, [threads]);

  const placed = useMemo(() => {
    const items = threads
      .map((thread) => ({
        thread,
        id: thread.root.id,
        y: offsets.get(thread.root.id) ?? 0,
        height: heights.get(thread.root.id) ?? 96,
      }))
      .sort((a, b) => a.y - b.y);
    const tops = stackTops(items, GAP, active);
    return items.map((item, index) => ({ ...item, top: tops[index]! }));
  }, [threads, offsets, heights, active]);

  const bottom = placed.reduce((max, item) => Math.max(max, item.top + item.height), 0);
  return (
    <div ref={box} className="relative" style={{ minHeight: bottom }}>
      {placed.map(({ thread, id, top }) => (
        <div
          key={id}
          data-slot-thread={id}
          style={{ transform: `translateY(${top}px)` }}
          className="absolute inset-x-0 top-0 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out"
        >
          {renderThread(thread)}
        </div>
      ))}
    </div>
  );
}
