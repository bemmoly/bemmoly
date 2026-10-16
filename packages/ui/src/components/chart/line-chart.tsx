import { cx } from '../../lib/cx.ts';
import {
  Axes,
  ChartFrame,
  FILL,
  niceTicks,
  PAD,
  STROKE,
  type ChartSeries,
} from './chart-frame.tsx';

export interface LineChartProps {
  /** Names the chart, e.g. "Sprint 15 burndown". */
  label: string;
  xLabels: readonly string[];
  series: readonly ChartSeries[];
  /** Stack the series as filled bands, first at the bottom: the cumulative flow. */
  stacked?: boolean;
  /** Plot height in px; 200 by default. */
  height?: number;
  className?: string;
}

const path = (points: readonly ([number, number] | null)[]) =>
  points
    .map((point, index) =>
      point ? `${index === 0 || !points[index - 1] ? 'M' : 'L'}${point[0]},${point[1]}` : '',
    )
    .join('');

/**
 * Lines over time (burndown, burnup, created against resolved) or, stacked, bands that add up
 * (cumulative flow). Status colours only, the legend above, the numbers in a hidden table.
 */
export function LineChart({
  label,
  xLabels,
  series,
  stacked = false,
  height = 200,
  className,
}: LineChartProps) {
  const sums = xLabels.map((_, index) =>
    series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0),
  );
  const max = stacked
    ? Math.max(0, ...sums)
    : Math.max(0, ...series.flatMap((item) => item.values.map((value) => value ?? 0)));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;

  return (
    <ChartFrame label={label} series={series} xLabels={xLabels} className={className}>
      {(width) => {
        const plot = width - PAD.left - PAD.right;
        const x = (index: number) =>
          PAD.left + (xLabels.length <= 1 ? plot / 2 : (index / (xLabels.length - 1)) * plot);
        const y = (value: number) => PAD.top + (1 - value / top) * (height - PAD.top - PAD.bottom);
        const base = xLabels.map(() => 0);
        return (
          <svg role="img" aria-label={label} width={width} height={height} className="block">
            <Axes ticks={ticks} y={y} xLabels={xLabels} x={x} width={width} height={height} />
            {series.map((item) => {
              if (stacked) {
                const lower = [...base];
                const upper = lower.map((value, index) => value + (item.values[index] ?? 0));
                upper.forEach((value, index) => (base[index] = value));
                const edge = upper.map((value, index): [number, number] => [x(index), y(value)]);
                const floor = lower
                  .map((value, index): [number, number] => [x(index), y(value)])
                  .reverse();
                return (
                  <g key={item.id}>
                    <path
                      d={`${path(edge)}${path(floor).replace('M', 'L')}Z`}
                      className={cx(FILL[item.tone], 'opacity-25')}
                    />
                    <path
                      d={path(edge)}
                      fill="none"
                      strokeWidth={1.5}
                      className={STROKE[item.tone]}
                    />
                  </g>
                );
              }
              const points = item.values.map((value, index): [number, number] | null =>
                value === null ? null : [x(index), y(value)],
              );
              return (
                <path
                  key={item.id}
                  d={path(points)}
                  fill="none"
                  strokeWidth={item.dashed ? 1 : 2}
                  strokeDasharray={item.dashed ? '4 4' : undefined}
                  strokeLinejoin="round"
                  className={STROKE[item.tone]}
                />
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
