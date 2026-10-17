import { formatNumber } from '@bemmoly/core-web';
import type { InsightsMeasures } from '@bemmoly/module-pipelines/shared';
import { formatDuration, formatShare } from '../../lib/format.ts';

export type MeasureKey = keyof InsightsMeasures;

export const MEASURES: readonly MeasureKey[] = [
  'leadTime',
  'deployFrequency',
  'changeFailureRate',
  'timeToRestore',
];

/** Which way is better: fewer seconds and failures, more deploys. */
export const HIGHER_IS_BETTER: Record<MeasureKey, boolean> = {
  leadTime: false,
  deployFrequency: true,
  changeFailureRate: false,
  timeToRestore: false,
};

/** A measure's value as people read it: "3h 10m", "12.4", "0.7%". */
export function formatMeasure(key: MeasureKey, value: number): string {
  if (key === 'leadTime' || key === 'timeToRestore') return formatDuration(value);
  if (key === 'changeFailureRate') return formatShare(value);
  return formatNumber(value, { maximumFractionDigits: value < 10 ? 1 : 0 });
}

export type Trend =
  { kind: 'none' } | { kind: 'same' } | { kind: 'up' | 'down'; change: string; better: boolean };

/**
 * How the range compares with the one before it. A rate moves in points (under 0.1 is the
 * same); anything else in percent of what it was (under 2% is the same).
 */
export function trendOf(key: MeasureKey, value: number | null, previous: number | null): Trend {
  if (value === null || previous === null) return { kind: 'none' };
  const rate = key === 'changeFailureRate';
  const delta = rate
    ? (value - previous) * 100
    : previous === 0
      ? 1
      : (value - previous) / previous;
  if (Math.abs(delta) < (rate ? 0.1 : 0.02)) return { kind: 'same' };
  const up = value > previous;
  return {
    kind: up ? 'up' : 'down',
    change: rate
      ? formatNumber(Math.abs(delta), { maximumFractionDigits: 1 })
      : formatShare(Math.abs(delta)),
    better: up === HIGHER_IS_BETTER[key],
  };
}
