import type { KeyboardEventHandler, MouseEventHandler, PointerEvent, Ref } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import type { EpicColor } from '../issue-card/epic-color.ts';

/*
 * One item on the roadmap's timeline: a bar from its start to its target in the epic's own
 * colour (a version is neutral), the done share deeper, the name inside when it fits. Past
 * the target, a hatched amber stretch reaches the forecast; under it, a thin whisker shows
 * the forecast range with a dot on the likely day. The bar is one button: arrows move it, the
 * screen's hook does the arithmetic, and the grips at either end resize it with the pointer.
 */

export type TimelineTone = EpicColor | 'neutral';

const TONES: Readonly<
  Record<TimelineTone, { body: string; edge: string; fill: string; solid: string }>
> = {
  'epic-1': {
    body: 'bg-epic-1/15',
    edge: 'border-epic-1/45',
    fill: 'bg-epic-1/30',
    solid: 'bg-epic-1',
  },
  'epic-2': {
    body: 'bg-epic-2/15',
    edge: 'border-epic-2/45',
    fill: 'bg-epic-2/30',
    solid: 'bg-epic-2',
  },
  'epic-3': {
    body: 'bg-epic-3/15',
    edge: 'border-epic-3/45',
    fill: 'bg-epic-3/30',
    solid: 'bg-epic-3',
  },
  'epic-4': {
    body: 'bg-epic-4/15',
    edge: 'border-epic-4/45',
    fill: 'bg-epic-4/30',
    solid: 'bg-epic-4',
  },
  'epic-5': {
    body: 'bg-epic-5/15',
    edge: 'border-epic-5/45',
    fill: 'bg-epic-5/30',
    solid: 'bg-epic-5',
  },
  'epic-6': {
    body: 'bg-epic-6/15',
    edge: 'border-epic-6/45',
    fill: 'bg-epic-6/30',
    solid: 'bg-epic-6',
  },
  'epic-7': {
    body: 'bg-epic-7/15',
    edge: 'border-epic-7/45',
    fill: 'bg-epic-7/30',
    solid: 'bg-epic-7',
  },
  'epic-8': {
    body: 'bg-epic-8/15',
    edge: 'border-epic-8/45',
    fill: 'bg-epic-8/30',
    solid: 'bg-epic-8',
  },
  neutral: { body: 'bg-sunken', edge: 'border-tx-3/50', fill: 'bg-line', solid: 'bg-tx-2' },
};

/** The striped amber of a forecast past its target, drawn from the signal tokens. */
const LATE_STRIPES =
  'repeating-linear-gradient(135deg, var(--amber-50) 0 4px, color-mix(in oklab, var(--amber) 22%, var(--amber-50)) 4px 8px)';

export type TimelineGrip = 'start' | 'end' | 'move';

export interface TimelineBarProps {
  /** Pixel offsets within the row's lane. */
  left: number;
  width: number;
  tone: TimelineTone;
  /** `item`: a 24px bar with its name; `child`: a 10px bar under an epic. */
  size?: 'item' | 'child';
  label?: string;
  /** Percent of the work done, drawn as the deeper part. */
  progress?: number;
  /** Hatched stretch from the bar's end to the forecast, with its words. */
  late?: { width: number; label: string } | null;
  /** The forecast range and likely day, as lane offsets. */
  range?: { from: number; likely: number; to: number; warn: boolean } | null;
  /** A release mark at the bar's end (versions). */
  milestone?: boolean;
  /** The start is not stored: the left edge fades. */
  openStart?: boolean;
  /** There is no target: a dashed outline in place of the fill. */
  ghost?: boolean;
  /** Shows the grips and the grab cursor. */
  movable?: boolean;
  pending?: boolean;
  dragging?: boolean;
  /** Words above the bar while it moves: the new dates. */
  hint?: string | null;
  'aria-label': string;
  'aria-describedby'?: string;
  'aria-keyshortcuts'?: string;
  tabIndex?: number;
  buttonRef?: Ref<HTMLButtonElement>;
  onGrab?: (grip: TimelineGrip, event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  onFocus?: () => void;
}

const MIN_WIDTH = 8;
const LABEL_INSIDE = 72;
const LATE_INSIDE = 92;

export function TimelineBar({
  left,
  width,
  tone,
  size = 'item',
  label,
  progress = 0,
  late,
  range,
  milestone = false,
  openStart = false,
  ghost = false,
  movable = false,
  pending = false,
  dragging = false,
  hint,
  tabIndex,
  buttonRef,
  onGrab,
  onKeyDown,
  onClick,
  onFocus,
  ...aria
}: TimelineBarProps) {
  const look = TONES[tone];
  const shown = Math.max(width, MIN_WIDTH);
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const item = size === 'item';
  const inside = item && label !== undefined && shown >= LABEL_INSIDE;
  const lateOutside = late !== null && late !== undefined && late.width < LATE_INSIDE;
  const end = left + shown + (late?.width ?? 0) + (milestone ? 8 : 0);
  const grab = (event: PointerEvent<HTMLButtonElement>) => {
    if (!onGrab || event.button !== 0) return;
    const grip = (event.target as HTMLElement).closest('[data-grip]')?.getAttribute('data-grip');
    onGrab(grip === 'start' || grip === 'end' ? grip : 'move', event);
  };
  return (
    <>
      {range && (
        <span
          aria-hidden
          className={cx(
            'absolute bottom-1 h-px',
            range.warn ? 'bg-amber' : 'bg-tx-3',
            !item && 'hidden',
          )}
          style={{ left: range.from, width: Math.max(1, range.to - range.from) }}
        >
          <i className="absolute -top-0.75 left-0 h-1.75 w-px bg-inherit" />
          <i className="absolute -top-0.75 right-0 h-1.75 w-px bg-inherit" />
          <i
            className="absolute -top-0.75 size-1.75 -translate-x-1/2 rounded-full bg-inherit"
            style={{ left: range.likely - range.from }}
          />
        </span>
      )}
      {late && item && (
        <span
          aria-hidden
          className="absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-r-chip border border-l-0 border-dashed border-amber pl-2 text-11 font-semibold whitespace-nowrap text-amber-tx"
          style={{ left: left + shown, width: late.width, backgroundImage: LATE_STRIPES }}
        >
          {late.width >= LATE_INSIDE ? late.label : ''}
        </span>
      )}
      <button
        ref={buttonRef}
        type="button"
        tabIndex={tabIndex}
        aria-busy={pending || undefined}
        aria-roledescription="timeline bar"
        {...aria}
        onPointerDown={grab}
        onKeyDown={onKeyDown}
        onClick={onClick}
        onFocus={onFocus}
        className={cx(
          'group/bar absolute top-1/2 m-0 flex -translate-y-1/2 items-center overflow-hidden border p-0 font-sans text-tx',
          item ? 'h-6 rounded-chip text-12 font-semibold' : 'h-2.5 rounded-tick',
          look.edge,
          ghost ? 'border-dashed bg-transparent' : item ? look.body : look.fill,
          late && item && 'rounded-r-none',
          movable ? 'cursor-grab touch-none active:cursor-grabbing' : 'cursor-pointer',
          dragging && 'z-2 shadow-e1h',
          pending && 'opacity-60 motion-safe:delay-(--duration-base)',
          'motion-safe:transition-[opacity,box-shadow]',
          focusRing,
        )}
        style={{
          left,
          width: shown,
          ...(openStart ? { maskImage: 'linear-gradient(to right, transparent, black 16px)' } : {}),
        }}
      >
        {item && !ghost && pct > 0 && (
          <span
            aria-hidden
            className={cx('absolute inset-y-0 left-0', look.fill)}
            style={{ width: `${pct}%` }}
          />
        )}
        {inside && (
          <span className="relative min-w-0 truncate px-2.5">
            {label}
            {pct > 0 ? <span className="font-normal text-tx-2"> · {pct}%</span> : null}
          </span>
        )}
        {movable && (
          <>
            <span
              aria-hidden
              data-grip="start"
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100 pointer-coarse:opacity-100"
            >
              <i className={cx('absolute inset-y-1 left-0.5 w-0.5 rounded-full', look.solid)} />
            </span>
            <span
              aria-hidden
              data-grip="end"
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100 pointer-coarse:opacity-100"
            >
              <i className={cx('absolute inset-y-1 right-0.5 w-0.5 rounded-full', look.solid)} />
            </span>
          </>
        )}
      </button>
      {milestone && (
        <span
          aria-hidden
          className={cx(
            'absolute top-1/2 size-2.5 -translate-1/2 rotate-45 rounded-tick',
            look.solid,
          )}
          style={{ left: left + shown }}
        />
      )}
      {item && ((label !== undefined && !inside) || lateOutside) && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 flex -translate-y-1/2 gap-2 pl-2 text-12 whitespace-nowrap"
          style={{ left: end }}
        >
          {label !== undefined && !inside && <span className="text-tx-2">{label}</span>}
          {lateOutside && <span className="font-semibold text-amber-tx">{late.label}</span>}
        </span>
      )}
      {hint && (
        <span
          role="status"
          className="absolute -top-1 z-3 -translate-y-full rounded-control bg-tx px-2 py-1 text-12 font-medium whitespace-nowrap text-canvas shadow-e2"
          style={{ left }}
        >
          {hint}
        </span>
      )}
    </>
  );
}
