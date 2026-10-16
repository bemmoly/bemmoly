import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { cx } from '../../lib/cx.ts';
import { LogRow, type LogMatchRanges, type LogViewLine } from './log-line.tsx';

export type { LogMatchRanges, LogViewLine, LogViewSpan, LogViewSpanKind } from './log-line.tsx';

export interface LogViewProps {
  /** Lines written so far (1-based numbers 1..totalLines). */
  totalLines: number;
  /** A loaded line, or undefined while it is being fetched. */
  getLine: (number: number) => LogViewLine | undefined;
  /** Called (debounced) with the visible range plus overscan when some of it is not loaded. */
  onRangeNeeded?: (from: number, to: number) => void;
  /**
   * Keep the view pinned to the end as lines arrive. Scrolling up by hand calls
   * onFollowChange(false); reaching the end again calls onFollowChange(true).
   */
  follow: boolean;
  onFollowChange?: (follow: boolean) => void;
  /** The selected line (?line=): an accent bar at the start edge. */
  selectedLine?: number | null;
  onSelectLine?: (number: number) => void;
  /** Scroll this line into view (centred) whenever `nonce` changes. */
  scrollTo?: { line: number; nonce: number } | null;
  /** Search hits to highlight: character ranges per line number. */
  matches?: ReadonlyMap<number, LogMatchRanges>;
  activeMatchLine?: number | null;
  /** Names the log: "Log of Unit 2 of 3". */
  ariaLabel: string;
  /** Accessible name for a line-number button: (n) => "Line 1,184". */
  lineLabel: (number: number) => string;
  className?: string;
}

const ROW = 20;
const OVERSCAN = 30;
const RANGE_DEBOUNCE_MS = 80;
/** How close to the end still counts as "at the end" for follow. */
const END_SLACK = ROW;

/**
 * A job's log, virtualised so a 100,000-line log scrolls like a short one: 20px rows, line
 * numbers that link the line, ANSI colours drawn with tokens, error lines on red-50. Lines load
 * by range as they come into view, and the view follows the end while the job writes.
 *
 * Semantics: the scroll container is a focusable, named region (arrows and Page keys scroll
 * it), holding a list whose rows carry aria-posinset and aria-setsize, so a screen reader
 * hears "line 1,184 of 1,212" although only the visible rows exist. role="log" is not used: it
 * announces every appended line, which a running job would turn into noise.
 */
export function LogView({
  totalLines,
  getLine,
  onRangeNeeded,
  follow,
  onFollowChange,
  selectedLine = null,
  onSelectLine,
  scrollTo = null,
  matches,
  activeMatchLine = null,
  ariaLabel,
  lineLabel,
  className,
}: LogViewProps) {
  const scroller = useRef<HTMLDivElement>(null);
  // TanStack Virtual hands back a mutable instance the compiler cannot memoise; this component
  // re-renders on scroll by design, so skipping compilation here costs nothing.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: totalLines,
    getScrollElement: () => scroller.current,
    estimateSize: () => ROW,
    overscan: OVERSCAN,
  });
  const items = virtualizer.getVirtualItems();
  const first = items[0]?.index ?? 0;
  const last = items[items.length - 1]?.index ?? -1;

  // Follow: pin to the end whenever lines arrive.
  useLayoutEffect(() => {
    if (!follow || totalLines === 0) return;
    virtualizer.scrollToIndex(totalLines - 1, { align: 'end' });
  }, [follow, totalLines, virtualizer]);

  const lastNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollTo || scrollTo.nonce === lastNonce.current) return;
    lastNonce.current = scrollTo.nonce;
    virtualizer.scrollToIndex(Math.max(0, scrollTo.line - 1), { align: 'center' });
  }, [scrollTo, virtualizer]);

  // Ask for lines in view that have not loaded, once scrolling settles.
  let missing = 0;
  for (let index = first; index <= last; index += 1) if (!getLine(index + 1)) missing += 1;
  const rangeNeeded = useRef(onRangeNeeded);
  useLayoutEffect(() => {
    rangeNeeded.current = onRangeNeeded;
  });
  useEffect(() => {
    if (missing === 0 || last < first) return undefined;
    const timer = setTimeout(() => rangeNeeded.current?.(first + 1, last + 1), RANGE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [first, last, missing]);

  // A hand scroll up stops following; scrolling back to the end resumes it.
  const lastTop = useRef(0);
  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const top = element.scrollTop;
    const atEnd = element.scrollHeight - top - element.clientHeight <= END_SLACK;
    if (follow && top < lastTop.current && !atEnd) onFollowChange?.(false);
    else if (!follow && top > lastTop.current && atEnd) onFollowChange?.(true);
    lastTop.current = top;
  };

  const before = items[0]?.start ?? 0;
  const after = virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0);
  return (
    <div
      ref={scroller}
      role="region"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
      className={cx(
        'h-full min-h-0 overflow-auto bg-sunken py-1.5 font-mono text-12 leading-5 text-tx-2 focus-ring-inset',
        className,
      )}
    >
      <div
        role="list"
        className="w-max min-w-full"
        style={{ paddingTop: before, paddingBottom: Math.max(0, after) }}
      >
        {items.map((item) => {
          const number = item.index + 1;
          return (
            <LogRow
              key={number}
              number={number}
              line={getLine(number)}
              selected={number === selectedLine}
              ranges={matches?.get(number)}
              activeMatch={number === activeMatchLine}
              position={number}
              size={totalLines}
              lineLabel={lineLabel}
              onSelect={onSelectLine}
            />
          );
        })}
      </div>
    </div>
  );
}
