import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { cx } from '../../lib/cx.ts';

export interface VirtualRange {
  /** First row in view. */
  start: number;
  /** One past the last row in view. */
  end: number;
}

export interface VirtualListHandle {
  /** Scrolls the least needed to show the row ("auto"), or puts it at the top ("start"). */
  scrollToIndex: (index: number, align?: 'auto' | 'start') => void;
  element: HTMLDivElement | null;
}

export interface VirtualListProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** How many rows the list holds. */
  count: number;
  /** Every row's height in pixels; rows never vary. */
  rowHeight: number;
  /** The viewport's height in pixels. */
  height: number;
  /** Rows drawn above and below the viewport, so a fast scroll never shows a gap. */
  overscan?: number;
  /** Draws one row; place it with `style` (absolute, at its offset, full width). */
  renderRow: (index: number, style: CSSProperties) => ReactNode;
  /** The rows in view (without overscan) whenever they change: for lazy counts and paging. */
  onRangeChange?: (range: VirtualRange) => void;
  /** A row kept in view: the keyboard's active row, scrolled to whenever it changes. */
  keepInView?: number;
  ref?: Ref<VirtualListHandle>;
}

/** The rows to draw for a scroll position: the ones in view plus the overscan either side. */
export function virtualWindow(
  scrollTop: number,
  viewport: number,
  rowHeight: number,
  count: number,
  overscan: number,
) {
  const start = Math.min(count, Math.max(0, Math.floor(scrollTop / rowHeight)));
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight));
  return {
    visible: { start, end },
    from: Math.max(0, start - overscan),
    to: Math.min(count, end + overscan),
  };
}

/**
 * A long list that draws only the rows in view: one scroll region with a spacer as tall as
 * every row together, and the visible rows placed on it. Roles are the caller's (a listbox
 * passes role, aria-multiselectable and aria-activedescendant through), so it carries no
 * semantics of its own.
 */
export function VirtualList({
  count,
  rowHeight,
  height,
  overscan = 4,
  renderRow,
  onRangeChange,
  keepInView,
  className,
  style,
  ref,
  ...rest
}: VirtualListProps) {
  const box = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(height);

  useEffect(() => {
    const element = box.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setViewport(element.clientHeight || height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const scrollToIndex = useCallback(
    (index: number, align: 'auto' | 'start' = 'auto') => {
      const element = box.current;
      if (!element) return;
      const top = index * rowHeight;
      const shown = element.clientHeight || height;
      if (align === 'start' || top < element.scrollTop) element.scrollTop = top;
      else if (top + rowHeight > element.scrollTop + shown) {
        element.scrollTop = top + rowHeight - shown;
      }
      setScrollTop(element.scrollTop);
    },
    [rowHeight, height],
  );
  useEffect(() => {
    if (keepInView !== undefined) scrollToIndex(keepInView);
  }, [keepInView, scrollToIndex]);
  useImperativeHandle(ref, () => ({ scrollToIndex, element: box.current }), [scrollToIndex]);

  const win = virtualWindow(scrollTop, viewport, rowHeight, count, overscan);
  const { start, end } = win.visible;
  useEffect(() => {
    onRangeChange?.({ start, end });
  }, [start, end, onRangeChange]);

  const rows: ReactNode[] = [];
  for (let index = win.from; index < win.to; index += 1) {
    rows.push(
      renderRow(index, {
        position: 'absolute',
        top: index * rowHeight,
        left: 0,
        right: 0,
        height: rowHeight,
      }),
    );
  }
  return (
    <div
      ref={box}
      className={cx('relative overflow-y-auto overscroll-contain', className)}
      style={{ ...style, height }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      {...rest}
    >
      <div className="relative" style={{ height: count * rowHeight }}>
        {rows}
      </div>
    </div>
  );
}
