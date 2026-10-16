import { cx } from '../../lib/cx.ts';
import { SeriesChart, type SeriesPoint } from './series-chart.tsx';

export type MetricVerdict = 'pass' | 'fail' | 'pending';

export interface MetricSide {
  /** "Canary 25%", "Stable". */
  label: string;
  /** "0.4%", "182 ms", or null while there is no sample yet. */
  value: string | null;
  series: readonly SeriesPoint[];
}

export interface MetricCompareProps {
  /** "Error rate", "p95 latency". */
  label: string;
  canary: MetricSide;
  stable: MetricSide;
  verdict: MetricVerdict;
  /** "Within limits", "Above stable", "Waiting for samples". */
  verdictLabel: string;
  /** Shown in place of a value with no sample: "No data". */
  emptyValue: string;
  className?: string;
}

const TONE: Record<MetricVerdict, string> = {
  pass: 'bg-green-50 text-green-tx',
  fail: 'bg-red-50 text-red-tx',
  pending: 'bg-line-2 text-tx-2',
};

/**
 * Canary against stable for one metric over the same window: both values, both lines (the
 * canary in accent, stable dashed and quiet), and the verdict that decides the next step. A
 * failing verdict reads in red text; the lines themselves never turn red.
 */
export function MetricCompare({
  label,
  canary,
  stable,
  verdict,
  verdictLabel,
  emptyValue,
  className,
}: MetricCompareProps) {
  const value = (side: MetricSide, emphasis: boolean) => (
    <span className="flex flex-col">
      <span className="text-11 text-tx-3">{side.label}</span>
      <span
        className={cx(
          'font-mono text-14 tabular-nums',
          emphasis ? 'font-semibold text-tx' : 'text-tx-2',
        )}
      >
        {side.value ?? emptyValue}
      </span>
    </span>
  );
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      <div className="flex items-center gap-2">
        <span className="text-13 font-medium text-tx">{label}</span>
        <span
          className={cx('ms-auto rounded-chip px-1.75 py-0.5 text-11 font-semibold', TONE[verdict])}
        >
          {verdictLabel}
        </span>
      </div>
      <div className="flex gap-6">
        {value(canary, true)}
        {value(stable, false)}
      </div>
      <SeriesChart
        points={canary.series}
        compare={stable.series}
        height={56}
        ariaLabel={`${label}: ${canary.label} ${canary.value ?? emptyValue}, ${stable.label} ${stable.value ?? emptyValue}`}
      />
    </div>
  );
}
