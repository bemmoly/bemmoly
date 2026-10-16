import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx.ts';

/** The status colours and two greys: the only marks a chart draws with. */
export type ChartTone = 'todo' | 'prog' | 'done' | 'muted' | 'ink';

export interface ChartSeries {
  id: string;
  label: string;
  tone: ChartTone;
  /** One value per x label; null leaves a gap. */
  values: readonly (number | null)[];
  /** A reference line, such as the burndown's guideline. */
  dashed?: boolean;
}

export const STROKE: Record<ChartTone, string> = {
  todo: 'stroke-todo',
  prog: 'stroke-prog',
  done: 'stroke-done',
  muted: 'stroke-tx-3',
  ink: 'stroke-tx-2',
};

export const FILL: Record<ChartTone, string> = {
  todo: 'fill-todo',
  prog: 'fill-prog',
  done: 'fill-done',
  muted: 'fill-tx-3',
  ink: 'fill-tx-2',
};

const SWATCH: Record<ChartTone, string> = {
  todo: 'bg-todo',
  prog: 'bg-prog',
  done: 'bg-done',
  muted: 'bg-tx-3',
  ink: 'bg-tx-2',
};

export const PAD = { top: 8, right: 8, bottom: 22, left: 32 } as const;
const FALLBACK_WIDTH = 640;

/** The width the chart has, measured, so its text stays at the type scale on every screen. */
export function useChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** A round top for the y axis and four ticks under it. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const step = 10 ** Math.floor(Math.log10(raw));
  const nice = [1, 2, 2.5, 5, 10].map((f) => f * step).find((s) => s >= raw) ?? raw;
  return Array.from(
    { length: Math.ceil(max / nice) + 1 },
    (_, i) => Math.round(i * nice * 100) / 100,
  );
}

/** Which x labels to print: about one per 64px, always the first and last. */
export function labelEvery(count: number, plotWidth: number): number {
  return Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / 64))));
}

export interface AxesProps {
  ticks: readonly number[];
  y: (value: number) => number;
  xLabels: readonly string[];
  x: (index: number) => number;
  width: number;
  height: number;
}

/** Horizontal rules at each tick with its value, and the x labels under the plot. */
export function Axes({ ticks, y, xLabels, x, width, height }: AxesProps) {
  const every = labelEvery(xLabels.length, width - PAD.left - PAD.right);
  return (
    <g aria-hidden="true" className="text-11">
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={width - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            className="stroke-line-2"
          />
          <text x={PAD.left - 6} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-tx-3">
            {tick}
          </text>
        </g>
      ))}
      {xLabels.map((label, index) =>
        index % every === 0 || index === xLabels.length - 1 ? (
          <text
            key={index}
            x={x(index)}
            y={height - 6}
            textAnchor={index === 0 ? 'start' : index === xLabels.length - 1 ? 'end' : 'middle'}
            className="fill-tx-3"
          >
            {label}
          </text>
        ) : null,
      )}
    </g>
  );
}

export interface ChartFrameProps {
  /** Names the chart for assistive tech and titles its data table. */
  label: string;
  series: readonly ChartSeries[];
  xLabels: readonly string[];
  children: (width: number) => ReactNode;
  /** The hidden table's columns and rows, when they are not one row per x label. */
  table?: { columns: readonly string[]; rows: readonly (readonly (string | number)[])[] };
  className?: string;
}

/**
 * A figure with the legend over the plot and the numbers as a visually hidden table, so the
 * chart never carries its meaning in colour or shape alone.
 */
export function ChartFrame({
  label,
  series,
  xLabels,
  children,
  table,
  className,
}: ChartFrameProps) {
  const { ref, width } = useChartWidth();
  const columns = table?.columns ?? ['Point', ...series.map((item) => item.label)];
  const rows =
    table?.rows ??
    xLabels.map((x, index) => [x, ...series.map((item) => item.values[index] ?? '')]);
  return (
    <figure className={cx('m-0 flex flex-col gap-2', className)}>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-12 text-tx-2">
        {series.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cx(
                'h-0.5 w-3 rounded-tick',
                SWATCH[item.tone],
                item.dashed && 'opacity-60',
              )}
            />
            {item.label}
          </span>
        ))}
      </figcaption>
      <div ref={ref} className="w-full">
        {children(width)}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([head, ...cells], index) => (
            <tr key={index}>
              <th scope="row">{head}</th>
              {cells.map((cell, column) => (
                <td key={column}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
