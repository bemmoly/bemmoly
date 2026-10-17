import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export interface TableVirtual {
  /** The element that scrolls: the frame's one scrolling area, never a box of the table's own. */
  getScrollElement: () => HTMLElement | null;
  /** Every row's height in pixels, its rule included. */
  rowHeight: number;
  /** Rows drawn beyond the visible ones on each side; 10 by default. */
  overscan?: number;
}

interface VirtualRowsProps<T> {
  rows: readonly T[];
  rowKey: (row: T) => string;
  virtual: TableVirtual;
  onEndReached?: (() => void) | undefined;
  renderRow: (row: T, index: number, style?: CSSProperties) => ReactNode;
}

/**
 * The table's body when only what is in view is drawn. The body's offset inside the scroll
 * area is the virtualiser's scroll margin, re-measured when anything above it changes size
 * (filters opening, a banner), so the rows never drift from the scroll position.
 */
export function VirtualRows<T>({
  rows,
  rowKey,
  virtual,
  onEndReached,
  renderRow,
}: VirtualRowsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  const { getScrollElement, rowHeight, overscan = 10 } = virtual;

  useLayoutEffect(() => {
    const pane = getScrollElement();
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
  }, [getScrollElement]);

  // TanStack Virtual hands back a mutable instance the compiler cannot memoise; the body
  // re-renders on scroll by design, so skipping compilation here costs nothing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize: () => rowHeight,
    overscan,
    scrollMargin: margin,
    getItemKey: (index) => {
      const row = rows[index];
      return row === undefined ? index : rowKey(row);
    },
  });
  const items = virtualizer.getVirtualItems();
  const last = items.at(-1)?.index ?? -1;

  const reached = useRef(onEndReached);
  useLayoutEffect(() => {
    reached.current = onEndReached;
  });
  // Ask for the next page a screen ahead of the end, so scrolling never meets a blank.
  const nearEnd = rows.length > 0 && last >= rows.length - overscan * 2;
  useEffect(() => {
    if (nearEnd) reached.current?.();
  }, [nearEnd, rows.length]);

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {items.map((item) => {
        const row = rows[item.index];
        if (row === undefined) return null;
        return renderRow(row, item.index, {
          position: 'absolute',
          insetInlineStart: 0,
          insetInlineEnd: 0,
          top: 0,
          height: rowHeight,
          transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
        });
      })}
    </div>
  );
}
