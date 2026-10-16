import { cx } from '../../lib/cx.ts';
import {
  Axes,
  ChartFrame,
  FILL,
  niceTicks,
  PAD,
  STROKE,
  type ChartSeries,
  type ChartTone,
} from './chart-frame.tsx';

export interface ScatterPoint {
  /** Position on the x axis, in the same unit as `xDomain` (an instant, for dates). */
  x: number;
  y: number;
  /** Names the point in the hidden table, e.g. "PLT-204 Session store". */
  label: string;
}

export interface ScatterReference {
  id: string;
  label: string;
  value: number;
  tone: ChartTone;
}

export interface ScatterChartProps {
  /** Names the chart, e.g. "Control chart". */
  label: string;
  points: readonly ScatterPoint[];
  /** What a point is called in the legend, e.g. "Issue". */
  pointLabel: string;
  tone?: ChartTone;
  xDomain: readonly [number, number];
  /** The x positions to label under the plot. */
  xTicks: readonly { value: number; label: string }[];
  /** How the hidden table prints a point's x, e.g. its date. */
  formatX: (x: number) => string;
  yLabel: string;
  /** Dashed horizontal lines across the plot, such as the mean. */
  references?: readonly ScatterReference[];
  height?: number;
  className?: string;
}

/** Points on a continuous x axis with dashed reference lines: the control chart. */
export function ScatterChart({
  label,
  points,
  pointLabel,
  tone = 'done',
  xDomain,
  xTicks,
  formatX,
  yLabel,
  references = [],
  height = 220,
  className,
}: ScatterChartProps) {
  const max = Math.max(0, ...points.map((point) => point.y), ...references.map((r) => r.value));
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? 1;
  const legend: ChartSeries[] = [
    { id: 'points', label: pointLabel, tone, values: [] },
    ...references.map((ref) => ({
      id: ref.id,
      label: ref.label,
      tone: ref.tone,
      dashed: true,
      values: [],
    })),
  ];
  const span = Math.max(1, xDomain[1] - xDomain[0]);

  return (
    <ChartFrame
      label={label}
      series={legend}
      xLabels={[]}
      table={{
        columns: [pointLabel, 'Date', yLabel],
        rows: points.map((point) => [point.label, formatX(point.x), point.y]),
      }}
      className={className}
    >
      {(width) => {
        const plot = width - PAD.left - PAD.right;
        const toX = (value: number) => PAD.left + ((value - xDomain[0]) / span) * plot;
        const y = (value: number) => PAD.top + (1 - value / top) * (height - PAD.top - PAD.bottom);
        return (
          <svg role="img" aria-label={label} width={width} height={height} className="block">
            <Axes
              ticks={ticks}
              y={y}
              xLabels={xTicks.map((tick) => tick.label)}
              x={(index) => toX(xTicks[index]?.value ?? xDomain[0])}
              width={width}
              height={height}
            />
            {references.map((ref) => (
              <line
                key={ref.id}
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(ref.value)}
                y2={y(ref.value)}
                strokeDasharray="4 4"
                className={STROKE[ref.tone]}
              />
            ))}
            {points.map((point, index) => (
              <circle
                key={index}
                cx={toX(point.x)}
                cy={y(point.y)}
                r={3.5}
                className={cx(FILL[tone], 'opacity-80')}
              />
            ))}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
