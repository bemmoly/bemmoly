import type { ErrorSeries } from '@bemmoly/module-pipelines/shared';

/** "Up from 0.2% to 1.9% since 14:05": the level before the rise and the latest value. */
export function riseOf(series: ErrorSeries): { from: number; to: number; at: string } | null {
  if (!series.riseAt || series.points.length < 2) return null;
  const rise = Date.parse(series.riseAt);
  const before = series.points.filter(([at]) => Date.parse(at) < rise).map(([, value]) => value);
  const last = series.points.at(-1)?.[1];
  if (before.length === 0 || last === undefined) return null;
  const sorted = [...before].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  return { from: median, to: last, at: series.riseAt };
}
