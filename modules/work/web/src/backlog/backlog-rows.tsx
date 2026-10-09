import type { Issue } from '@bemmoly/module-work/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { registerScroller } from '../hooks/backlog-scroll.ts';
import { BacklogItem, type RowHandlers } from './backlog-item.tsx';
import type { Lookups } from './model.ts';

/** 8px padding above and below a 22px avatar, and the 1px rule. */
export const ROW_HEIGHT = 39;
/** Lists up to this long render whole; longer ones render what is on screen. */
export const VIRTUAL_FROM = 80;

export interface BacklogRowsProps {
  containerId: string;
  issues: readonly Issue[];
  lookups: Lookups;
  handlers: RowHandlers;
  entryId: string | null;
  scrollRef: RefObject<HTMLElement | null>;
}

export function BacklogRows(props: BacklogRowsProps) {
  return props.issues.length > VIRTUAL_FROM ? <VirtualRows {...props} /> : <PlainRows {...props} />;
}

function PlainRows({ containerId, issues, lookups, handlers, entryId }: BacklogRowsProps) {
  return (
    <>
      {issues.map((issue) => (
        <BacklogItem
          key={issue.id}
          issue={issue}
          containerId={containerId}
          lookups={lookups}
          handlers={handlers}
          entry={issue.id === entryId}
        />
      ))}
    </>
  );
}

/**
 * Rows of a long container through TanStack Virtual, on the pane every
 * container shares: the list's offset in the pane is its scroll margin, kept
 * current as the containers above it open, close and grow.
 */
function VirtualRows({
  containerId,
  issues,
  lookups,
  handlers,
  entryId,
  scrollRef,
}: BacklogRowsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);

  useLayoutEffect(() => {
    const pane = scrollRef.current;
    const list = listRef.current;
    if (!pane || !list) return undefined;
    const measure = () => {
      const offset =
        list.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop;
      setMargin((current) => (Math.abs(current - offset) < 1 ? current : offset));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (pane.firstElementChild) observer.observe(pane.firstElementChild);
    return () => observer.disconnect();
  }, [scrollRef]);

  const virtualizer = useVirtualizer({
    count: issues.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    scrollMargin: margin,
    getItemKey: (index) => issues[index]?.id ?? index,
  });

  useEffect(
    () =>
      registerScroller(containerId, (index) => virtualizer.scrollToIndex(index, { align: 'auto' })),
    [containerId, virtualizer],
  );

  const items = virtualizer.getVirtualItems();
  const entryIndex = entryId ? issues.findIndex((issue) => issue.id === entryId) : -1;
  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      <div
        className="absolute inset-x-0 top-0"
        style={{ transform: `translateY(${(items[0]?.start ?? margin) - margin}px)` }}
      >
        {items.map((item) => {
          const issue = issues[item.index];
          if (!issue) return null;
          return (
            <BacklogItem
              key={item.key}
              issue={issue}
              containerId={containerId}
              lookups={lookups}
              handlers={handlers}
              entry={item.index === entryIndex}
              index={item.index}
            />
          );
        })}
      </div>
    </div>
  );
}
