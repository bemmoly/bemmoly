import type { ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';
import { ProgressBar } from '../progress-bar/progress-bar.tsx';

export interface MetricTileProps {
  /** "Velocity", "Flow": 12.5px in tx4. */
  label: ReactNode;
  /** The figure in 12px mono medium, e.g. "14/23 pts" or "▲ 18%". */
  value?: ReactNode;
  /** ok for a rising flow, warn for a falling one; default is the text colour. */
  valueTone?: 'default' | 'ok' | 'warn';
  /** A ProgressBar or MetricSparkline between the label and the value, or after it. */
  children?: ReactNode;
  /** Children before the value (Flow) rather than after it (Velocity). */
  childrenFirst?: boolean;
  className?: string;
}

const TONES = { default: 'text-tx', ok: 'text-ok', warn: 'text-warn-fg' } as const;

/**
 * A tile of the Board header's metrics strip: 32px tall, 10px side padding, 8px between parts,
 * the br3 border on the surface with the control radius.
 */
export function MetricTile({
  label,
  value,
  valueTone = 'default',
  children,
  childrenFirst = false,
  className,
}: MetricTileProps) {
  const figure = value !== undefined && (
    <span className={cx('font-mono text-12 font-medium', TONES[valueTone])}>{value}</span>
  );
  return (
    <div
      className={cx(
        'flex h-control items-center gap-2 rounded-control border border-br3 bg-sf px-2.5 text-12h',
        className,
      )}
    >
      <span className="text-tx4">{label}</span>
      {childrenFirst ? children : figure}
      {childrenFirst ? figure : children}
    </div>
  );
}

export interface MetricSparklineProps {
  /** Bar heights as percentages of 14px; the last `recent` bars are the accent, the rest muted. */
  values: readonly number[];
  recent?: number;
  label: string;
  className?: string;
}

/** The Flow tile's seven 4px bars, 2px apart, bottom-aligned in a 14px band. */
export function MetricSparkline({ values, recent = 3, label, className }: MetricSparklineProps) {
  const first = Math.max(0, values.length - recent);
  return (
    <span role="img" aria-label={label} className={cx('flex h-3.5 items-end gap-0.5', className)}>
      {values.map((value, index) => (
        <span
          key={index}
          className={cx('w-1', index >= first ? 'bg-ac' : 'bg-ac-mute')}
          style={{ height: `${Math.max(0, Math.min(100, value))}%` }}
        />
      ))}
    </span>
  );
}

export interface CapacityBarProps {
  /** Points committed (Scrum) or done, against the capacity or the sprint total. */
  committed: number;
  capacity: number;
  unit?: string;
  /** Names the bar, e.g. "Sprint 15 capacity". */
  label: string;
  /** Show the "committed of capacity" text before the bar. */
  showText?: boolean;
  className?: string;
}

/**
 * Committed points against capacity: the Backlog header's "19 of ~22 pts capacity" line and the
 * Board's 80px x 6px velocity bar. Under capacity fills ok; over fills warn, as the overflow
 * text does.
 */
export function CapacityBar({
  committed,
  capacity,
  unit = 'pts',
  label,
  showText = true,
  className,
}: CapacityBarProps) {
  const over = committed > capacity;
  const pct = capacity > 0 ? (committed / capacity) * 100 : 0;
  return (
    <span className={cx('inline-flex items-center gap-2', className)}>
      {showText && (
        <span className={cx('text-12', over ? 'text-warn-fg' : 'text-ok-fg')}>
          {committed} of {capacity} {unit} capacity
        </span>
      )}
      <ProgressBar
        value={pct}
        size="md"
        label={label}
        fillClassName={over ? 'bg-warn' : 'bg-ok'}
        className="w-20"
      />
    </span>
  );
}
