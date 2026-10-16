import { cx } from '../../lib/cx.ts';
import { Axes, ChartFrame, FILL, niceTicks, PAD, type ChartSeries } from './chart-frame.tsx';

export interface BarChartProps {
  /** Names the chart, e.g. "Velocity, last six sprints". */
  label: string;
  xLabels: readonly string[];
  /** Drawn side by side within each group, in order. */
  series: readonly ChartSeries[];
  height?: number;
  className?: string;
}

/** Grouped bars per category: the velocity chart's committed and completed points per sprint. */
export function BarChart({ label, xLabels, series, height = 200, className }: BarChartProps) {
  const max = Math.max(0, ...series.flatMap((item) => item.values.map((value) => value ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;

  return (
    <ChartFrame label={label} series={series} xLabels={xLabels} className={className}>
      {(width) => {
        const plot = width - PAD.left - PAD.right;
        const group = plot / Math.max(1, xLabels.length);
        const bar = Math.min(24, (group * 0.7) / Math.max(1, series.length));
        const x = (index: number) => PAD.left + group * index + group / 2;
        const y = (value: number) => PAD.top + (1 - value / top) * (height - PAD.top - PAD.bottom);
        return (
          <svg role="img" aria-label={label} width={width} height={height} className="block">
            <Axes ticks={ticks} y={y} xLabels={xLabels} x={x} width={width} height={height} />
            {series.map((item, s) =>
              item.values.map((value, index) =>
                value === null ? null : (
                  <rect
                    key={`${item.id}-${index}`}
                    x={x(index) - (bar * series.length) / 2 + bar * s}
                    y={y(value)}
                    width={Math.max(1, bar - 2)}
                    height={Math.max(0, y(0) - y(value))}
                    rx={2}
                    className={cx(FILL[item.tone])}
                  />
                ),
              ),
            )}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
