import type { MouseEventHandler } from 'react';
import { cx } from '../../lib/cx.ts';
import { focusRing } from '../../lib/focus.ts';
import { StatusGlyph } from '../glyphs/status-glyph.tsx';

/*
 * A roadmap item's forecast in two words. Signal colours carry the meaning (green on track,
 * amber at risk or late) and the words always say it too; states without a date are quiet
 * text. The forecast is arithmetic, never AI, so it is never lilac.
 */

export type ForecastChipState =
  'done' | 'on_track' | 'at_risk' | 'late' | 'no_target' | 'no_forecast' | 'no_work';

export interface ForecastChipProps {
  state: ForecastChipState;
  /** Days past the target, for "11 days late". */
  daysLate?: number | null;
  /** Opens the forecast; the chip is a button when given. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  /** What the button does, for assistive tech: "Billing v2 forecast". */
  label?: string;
  className?: string;
}

const days = (count: number) => `${count} ${count === 1 ? 'day' : 'days'}`;

/** The chip's words, also used where the chip is too wide (the phone's rows). */
export function forecastWords(state: ForecastChipState, daysLate?: number | null): string {
  switch (state) {
    case 'done':
      return 'Done';
    case 'on_track':
      return 'On track';
    case 'at_risk':
      return 'At risk';
    case 'late':
      return daysLate && daysLate > 0 ? `${days(daysLate)} late` : 'Late';
    case 'no_target':
      return 'No target';
    case 'no_forecast':
      return 'Too early to tell';
    case 'no_work':
      return 'No issues';
  }
}

const TONES: Record<ForecastChipState, string> = {
  done: 'bg-transparent text-tx-2',
  on_track: 'bg-green-50 text-green-tx',
  at_risk: 'bg-amber-50 text-amber-tx',
  late: 'bg-amber-50 text-amber-tx',
  no_target: 'bg-transparent text-tx-3',
  no_forecast: 'bg-transparent text-tx-3',
  no_work: 'bg-transparent text-tx-3',
};

export function ForecastChip({ state, daysLate, onClick, label, className }: ForecastChipProps) {
  const words = forecastWords(state, daysLate);
  const body = (
    <>
      {state === 'done' && <StatusGlyph stage="done" decorative />}
      {words}
    </>
  );
  const classes = cx(
    'inline-flex h-5 shrink-0 items-center gap-1 rounded-chip px-1.5 text-11 font-semibold whitespace-nowrap tabular-nums',
    TONES[state],
    className,
  );
  if (!onClick) return <span className={classes}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ? `${label}: ${words}` : undefined}
      className={cx(classes, 'm-0 cursor-pointer border-0 font-sans hover:underline', focusRing)}
    >
      {body}
    </button>
  );
}
