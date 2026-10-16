import { cx } from '../../lib/cx.ts';

export interface SeriesPoint {
  /** A time in milliseconds, or an index; only the order and spacing matter. */
  at: number;
  value: number;
}

export interface SeriesMarker {
  key: string;
  at: number;
  /** "pricing-svc v2.18.0 us-east1". */
  label: string;
  /** warn: the change that landed just before a rise. */
  tone?: 'muted' | 'warn';
}

export interface SeriesChartProps {
  points: readonly SeriesPoint[];
  /** A quieter second series drawn under the first: stable beside canary. */
  compare?: readonly SeriesPoint[];
  kind?: 'line' | 'bars';
  /** danger draws the line red: an error rate. accent: anything else. */
  tone?: 'accent' | 'danger';
  markers?: readonly SeriesMarker[];
  /** A dashed level across the chart: a limit or a target. */
  threshold?: number;
  /** The x range; defaults to the points' own. */
  range?: readonly [number, number];
  /** The top of the y axis; defaults to the highest value with some headroom. */
  max?: number;
  /**
   * zero: the y axis starts at 0, for amounts. fit: it spans the values, for a trend line
   * where the shape matters more than the size.
   */
  baseline?: 'zero' | 'fit';
  height?: number;
  /** What the chart shows, read instead of the drawing. */
  ariaLabel: string;
  className?: string;
}

const W = 1000;

/**
 * A small time series: a line (or bars) on the chart's own scale, with dashed markers for
 * the moments that matter and an optional dashed threshold. The drawing scales to any width;
 * strokes and labels keep their size, and marker labels are text, not SVG, so they stay
 * crisp and readable.
 */
export function SeriesChart({
  points,
  compare,
  kind = 'line',
  tone = 'accent',
  markers = [],
  threshold,
  range,
  max,
  baseline = 'zero',
  height = 120,
  ariaLabel,
  className,
}: SeriesChartProps) {
  const all = [...points, ...(compare ?? [])];
  const first = range?.[0] ?? Math.min(...all.map((point) => point.at));
  const last = range?.[1] ?? Math.max(...all.map((point) => point.at));
  const values = all.map((point) => point.value);
  const highest = Math.max(threshold ?? 0, ...values);
  const fit = baseline === 'fit';
  const room = fit ? (highest - Math.min(...values)) * 0.15 || highest * 0.1 || 1 : 0;
  const bottom = fit ? Math.max(0, Math.min(...values) - room) : 0;
  const top = max ?? ((fit ? highest + room : highest * 1.15) || 1);
  const span = last - first || 1;
  const pad = markers.length > 0 ? 22 : 4;
  const x = (at: number) => ((at - first) / span) * W;
  const y = (value: number) =>
    height - 2 - ((Math.min(value, top) - bottom) / (top - bottom || 1)) * (height - pad - 2);
  const line = (series: readonly SeriesPoint[]) =>
    series.map((point) => `${x(point.at).toFixed(1)},${y(point.value).toFixed(1)}`).join(' ');
  const barWidth = (W / Math.max(points.length, 1)) * 0.7;
  return (
    <div className={cx('relative', className)} style={{ height }}>
      <svg
        role="img"
        aria-label={ariaLabel}
        width="100%"
        height={height}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="block overflow-visible"
      >
        {threshold !== undefined && (
          <line
            x1={0}
            x2={W}
            y1={y(threshold)}
            y2={y(threshold)}
            stroke="var(--tx-3)"
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {markers.map((marker) => (
          <line
            key={marker.key}
            x1={x(marker.at)}
            x2={x(marker.at)}
            y1={pad - 6}
            y2={height}
            stroke={marker.tone === 'warn' ? 'var(--amber)' : 'var(--tx-3)'}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {kind === 'bars' ? (
          points.map((point) => (
            <rect
              key={point.at}
              x={x(point.at) - (points.length > 1 ? 0 : barWidth / 2)}
              y={y(point.value)}
              width={barWidth}
              height={Math.max(0, height - 2 - y(point.value))}
              rx={1.5}
              fill="var(--acc-100)"
            />
          ))
        ) : (
          <>
            {compare && compare.length > 1 && (
              <polyline
                fill="none"
                stroke="var(--tx-3)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                points={line(compare)}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke={tone === 'danger' ? 'var(--red)' : 'var(--acc)'}
                strokeWidth={2}
                strokeLinejoin="round"
                points={line(points)}
                vectorEffect="non-scaling-stroke"
              />
            )}
          </>
        )}
      </svg>
      {markers.map((marker, index) => {
        const at = x(marker.at) / W;
        return (
          <span
            key={marker.key}
            aria-hidden
            className="absolute max-w-48 truncate text-11 whitespace-nowrap text-tx-2"
            style={{
              top: index % 2 === 0 ? 0 : 13,
              ...(at > 0.7
                ? { right: `calc(${((1 - at) * 100).toFixed(2)}% + 4px)` }
                : { left: `calc(${(at * 100).toFixed(2)}% + 4px)` }),
            }}
          >
            {marker.label}
          </span>
        );
      })}
    </div>
  );
}
