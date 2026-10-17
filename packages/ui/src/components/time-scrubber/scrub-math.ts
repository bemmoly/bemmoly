/*
 * The TimeScrubber's arithmetic, apart from the drawing so it can be tested without a DOM.
 * The range runs from the first bucket's start to the end of the last one ("now"); a value
 * of null is live, which is where the handle rests at the end.
 */

export interface ScrubRange {
  min: number;
  max: number;
  step: number;
}

export function rangeOf(starts: readonly string[], step: number): ScrubRange {
  const first = starts.length ? Date.parse(starts[0] ?? '') : Date.now() - step;
  const last = starts.length ? Date.parse(starts[starts.length - 1] ?? '') : first;
  return { min: first, max: last + step, step };
}

/** The handle's place, 0 to 1; live sits at 1. */
export function fractionOf(value: string | null, range: ScrubRange): number {
  if (value === null || range.max <= range.min) return 1;
  const at = (Date.parse(value) - range.min) / (range.max - range.min);
  return Number.isFinite(at) ? Math.max(0, Math.min(1, at)) : 1;
}

/**
 * The value a time in ms stands for: snapped to a bucket's start, or live when it is within
 * half a bucket of the end.
 */
export function valueAt(time: number, range: ScrubRange): string | null {
  if (time >= range.max - range.step / 2) return null;
  const clamped = Math.max(range.min, time);
  const bucket = Math.floor((clamped - range.min) / range.step);
  return new Date(range.min + bucket * range.step).toISOString();
}

/** A pointer at this share of the track's width. */
export function valueAtFraction(fraction: number, range: ScrubRange): string | null {
  const share = Math.max(0, Math.min(1, fraction));
  return valueAt(range.min + share * (range.max - range.min), range);
}

/** Moves the value by `delta` ms, as the arrow keys do; past the end is live. */
export function stepValue(value: string | null, delta: number, range: ScrubRange): string | null {
  const from = value === null ? range.max : Date.parse(value);
  return valueAt(from + delta, range);
}

/** Bar heights as shares of the tallest, never below a visible stub. */
export function barHeights(counts: readonly number[], minimum = 0.08): number[] {
  const top = Math.max(1, ...counts);
  return counts.map((count) => Math.max(minimum, count / top));
}
