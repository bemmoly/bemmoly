import {
  useCallback,
  useMemo,
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { cx } from '../../lib/cx.ts';
import {
  barHeights,
  fractionOf,
  rangeOf,
  stepValue,
  valueAt,
  valueAtFraction,
} from './scrub-math.ts';

export interface TimeScrubberBucket {
  start: string;
  deploys: number;
  incident: boolean;
}

export interface TimeScrubberProps {
  /** Oldest first, equal width (15 minutes each by default). */
  buckets: readonly TimeScrubberBucket[];
  /** null is live (the handle at the end); otherwise an ISO time inside the range. */
  value: string | null;
  /** While dragging: called at most once per animation frame. */
  onChange: (value: string | null) => void;
  /** Pointer released or key handled: the screen commits the URL then. */
  onCommit?: (value: string | null) => void;
  /** Bucket length in ms, default 15 minutes; also the arrow-key step. */
  stepMs?: number;
  /** "Rewind the map". */
  ariaLabel: string;
  /** For aria-valuetext, the handle's chip and the tick labels. */
  formatTime: (iso: string) => string;
  /** Read as the value while live: "Live". */
  liveLabel: string;
  /** Indices into `buckets` to label under the bars. */
  ticks?: readonly number[];
  /** The label at the end of the tick row: "Now 10:47". */
  formatNow?: (iso: string) => string;
  className?: string;
}

const QUARTER = 15 * 60_000;
const HOUR = 60 * 60_000;

/**
 * The Release map's timeline: deploys per bucket as bars, incidents in red, and a handle that
 * rewinds the map. Drag anywhere on the bars, click a bar, or use the keys (arrows step a
 * bucket, Shift an hour, Home the oldest, End back to live). Bars after the handle dim while
 * the map is rewound, so the present reads as not yet happened.
 */
export function TimeScrubber({
  buckets,
  value,
  onChange,
  onCommit,
  stepMs = QUARTER,
  ariaLabel,
  formatTime,
  liveLabel,
  ticks = [],
  formatNow,
  className,
}: TimeScrubberProps) {
  const track = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const latest = useRef<string | null>(value);
  const starts = useMemo(() => buckets.map((bucket) => bucket.start), [buckets]);
  const range = useMemo(() => rangeOf(starts, stepMs), [starts, stepMs]);
  const heights = useMemo(() => barHeights(buckets.map((bucket) => bucket.deploys)), [buckets]);
  const fraction = fractionOf(value, range);
  const live = value === null;
  const handleBucket = live ? buckets.length : Math.floor(fraction * buckets.length);
  const nowIso = new Date(range.max).toISOString();

  const emit = useCallback(
    (next: string | null) => {
      latest.current = next;
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        onChange(latest.current);
      });
    },
    [onChange],
  );

  const fromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || box.width === 0) return latest.current;
    const fromStart = document.dir === 'rtl' ? box.right - event.clientX : event.clientX - box.left;
    return valueAtFraction(fromStart / box.width, range);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    emit(fromPointer(event));
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    emit(fromPointer(event));
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const next = fromPointer(event);
    latest.current = next;
    onChange(next);
    onCommit?.(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const big = event.shiftKey ? HOUR : stepMs;
    const keys: Record<string, () => string | null> = {
      ArrowLeft: () => stepValue(value, -big, range),
      ArrowDown: () => stepValue(value, -big, range),
      ArrowRight: () => stepValue(value, big, range),
      ArrowUp: () => stepValue(value, big, range),
      PageDown: () => stepValue(value, -HOUR, range),
      PageUp: () => stepValue(value, HOUR, range),
      Home: () => valueAt(range.min, range),
      End: () => null,
    };
    const move = keys[event.key];
    if (!move) return;
    event.preventDefault();
    const next = move();
    latest.current = next;
    onChange(next);
    onCommit?.(next);
  };

  const dense = buckets.length > 200;
  const at = `${(fraction * 100).toFixed(2)}%`;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div
        ref={track}
        data-part="track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={cx(
          'relative flex h-11 cursor-ew-resize touch-none items-end select-none',
          dense ? 'gap-px' : 'gap-0.5',
        )}
      >
        {buckets.map((bucket, index) => (
          <span
            key={bucket.start}
            aria-hidden
            data-incident={bucket.incident || undefined}
            className={cx(
              'min-w-0 flex-1 rounded-tick motion-safe:transition-opacity',
              bucket.incident ? 'bg-red' : 'bg-acc-100',
              !live && index >= handleBucket && 'opacity-35',
            )}
            style={{ height: `${((heights[index] ?? 0) * 100).toFixed(1)}%` }}
          />
        ))}
        <div
          role="slider"
          tabIndex={0}
          aria-label={ariaLabel}
          aria-valuemin={range.min}
          aria-valuemax={range.max}
          aria-valuenow={live ? range.max : Date.parse(value)}
          aria-valuetext={live ? liveLabel : formatTime(value)}
          onKeyDown={onKeyDown}
          className="absolute -top-1.5 -bottom-1 flex w-4 -translate-x-1/2 justify-center rounded-tick outline-0 focus-ring rtl:translate-x-1/2"
          style={{ insetInlineStart: at }}
        >
          <span aria-hidden className="h-full w-0.5 rounded-tick bg-acc" />
          {live ? null : (
            <span
              aria-hidden
              data-part="chip"
              className={cx(
                'absolute top-0 rounded-chip bg-acc-fill px-1.5 py-px text-11 font-medium whitespace-nowrap text-on-acc tabular-nums shadow-e1',
                fraction > 0.92 && 'end-1',
                fraction < 0.08 && 'start-1',
              )}
            >
              {formatTime(value)}
            </span>
          )}
        </div>
      </div>
      {ticks.length > 0 || formatNow ? (
        <div aria-hidden className="flex justify-between gap-2 text-11 text-tx-3 tabular-nums">
          {ticks.map((index) => {
            const bucket = buckets[index];
            return bucket ? <span key={bucket.start}>{formatTime(bucket.start)}</span> : null;
          })}
          {formatNow ? <span>{formatNow(nowIso)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
